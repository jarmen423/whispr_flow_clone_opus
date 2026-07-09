"""
WakeListener — always-listening activation loop for the LocalFlow agent.

This module owns a sounddevice InputStream at 16 kHz mono. Each 80 ms
frame (~1280 samples) is fanned out to:

    1. WakeWordDetector (openwakeword) — phrase detection
    2. ClapDetector     — peak detection
    3. (frames are NOT recorded here — the caller drives AudioRecorder
       from the on_start / on_stop callbacks)

Start/stop callbacks are driven by the detector output, not by hotkey
events. This keeps the wake-word feature as a pure add-on to the existing
recording pipeline.

Callback contract (passed to ``__init__``):
    on_start(mode: str) -> None       # mode in {"dictation", "agent"}
    on_stop() -> None
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Callable, Optional

import numpy as np

try:
    import sounddevice as sd
except ImportError:  # pragma: no cover
    sd = None  # type: ignore

from .config import CONFIG, log_info, log_warning, log_error

logger = logging.getLogger("localflow.wake_listener")

# 16 kHz mono, 80 ms frames = 1280 samples per frame.
SAMPLE_RATE = 16000
FRAME_SAMPLES = 1280


class WakeListener:
    """Owns the always-listening mic stream and runs detectors on each frame."""

    def __init__(
        self,
        on_start: Callable[[str], None],
        on_stop: Callable[[], None],
    ) -> None:
        self._on_start = on_start
        self._on_stop = on_stop

        self._stream: Optional[sd.InputStream] = None
        self._running = False
        self._lock = threading.Lock()

        # State for the active recording window (set by start, cleared by stop).
        self._active_mode: Optional[str] = None  # "dictation" | "agent" | None
        self._active_started_at: Optional[float] = None

        # Detectors — built lazily in start() so ImportError is surfaced
        # only when the user actually opts in.
        self._wake_detector = None
        self._clap_detector = None

        # Snapshot config at construction so config changes mid-run
        # don't surprise us.
        self._start_mode: str = CONFIG.wake_word_start_mode
        self._stop_mode: str = CONFIG.wake_word_stop_mode
        self._dictation_phrase: str = CONFIG.wake_word_dictation_phrase
        self._agent_phrase: str = CONFIG.wake_word_agent_phrase
        self._stop_phrase: str = CONFIG.wake_word_stop_phrase
        self._timeout_s: int = int(CONFIG.wake_word_timeout_seconds)
        self._clap_enabled: bool = bool(CONFIG.clap_enabled)
        self._clap_threshold_db: float = float(CONFIG.clap_threshold_db)
        self._clap_window_ms: int = int(CONFIG.clap_window_ms)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """Open the mic stream and start the detector loop. Returns True on success."""
        if sd is None:
            log_error("WakeListener: sounddevice is not installed")
            return False

        if self._running:
            return True

        # Build detectors (lazy, so optional-dep import errors are surfaced here).
        wake_armed = self._start_mode in ("wake", "both") or self._stop_mode in ("wake", "any")
        if wake_armed:
            try:
                from .wake_word import WakeWordDetector
                self._wake_detector = WakeWordDetector(
                    phrases=[self._dictation_phrase, self._agent_phrase]
                )
            except ImportError as exc:
                log_error(f"WakeListener: wake-word init failed: {exc}")
                return False

        clap_armed = (self._start_mode in ("clap", "both") or self._stop_mode in ("clap", "any")) and self._clap_enabled
        if clap_armed:
            try:
                from .clap_detector import ClapDetector
                self._clap_detector = ClapDetector(
                    threshold_db=self._clap_threshold_db,
                    window_ms=self._clap_window_ms,
                )
            except ImportError as exc:
                log_error(f"WakeListener: clap detector init failed: {exc}")
                return False

        if self._wake_detector is None and self._clap_detector is None:
            log_warning(
                "WakeListener: no detectors enabled — nothing to listen for. "
                "Set wake_word_enabled=true and/or clap_enabled=true in "
                "~/.localflow/config.json (or via `localflow-agent --setup`)."
            )
            return False

        try:
            self._stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="int16",
                blocksize=FRAME_SAMPLES,
                callback=self._on_stream_frame,
            )
            self._stream.start()
        except Exception as exc:
            log_error(f"WakeListener: failed to open mic stream: {exc}")
            return False

        self._running = True
        log_info(
            f"WakeListener: listening (start={self._start_mode}, "
            f"stop={self._stop_mode}, timeout={self._timeout_s}s)"
        )
        return True

    def stop(self) -> None:
        """Close the mic stream and stop the detector loop."""
        with self._lock:
            self._running = False
            if self._stream is not None:
                try:
                    self._stream.stop()
                    self._stream.close()
                except Exception:
                    pass
                self._stream = None
        log_info("WakeListener: stopped")

    # ------------------------------------------------------------------
    # Stream callback
    # ------------------------------------------------------------------

    def _on_stream_frame(self, indata, frames, time_info, status) -> None:
        """sounddevice callback — runs on PortAudio thread, keep it short."""
        if not self._running:
            return
        if status:
            logger.debug("WakeListener stream status: %s", status)

        # indata shape: (frames, channels) int16
        audio_int16 = indata[:, 0].copy()
        audio_float32 = (audio_int16.astype(np.float32) / 32768.0)

        # 1. Check the wake-word detector.
        wake_hit: Optional[str] = None
        if self._wake_detector is not None:
            try:
                scores = self._wake_detector.process_frame(audio_int16)
                for phrase, score in scores.items():
                    if score >= 0.5:  # detector's own threshold
                        wake_hit = phrase
                        break
            except Exception as exc:
                logger.debug("WakeWordDetector error: %s", exc)

        # 2. Check the clap detector.
        clap_hit = False
        if self._clap_detector is not None:
            try:
                clap_hit = self._clap_detector.process_frame(audio_float32) is not None
            except Exception as exc:
                logger.debug("ClapDetector error: %s", exc)

        # 3. Resolve start/stop. Hold the lock briefly to update shared state.
        with self._lock:
            self._resolve_signals(wake_hit, clap_hit)

    # ------------------------------------------------------------------
    # State machine
    # ------------------------------------------------------------------

    def _resolve_signals(self, wake_hit: Optional[str], clap_hit: bool) -> None:
        """Apply the configured start/stop matrix. Must be called with self._lock held."""
        now = time.monotonic()
        is_recording = self._active_mode is not None

        # Timeout — always-armed when recording.
        if is_recording and self._timeout_s > 0:
            elapsed = now - (self._active_started_at or now)
            if elapsed >= self._timeout_s:
                log_info(f"WakeListener: timeout ({self._timeout_s}s) — stopping")
                self._end_window()
                return

        # STOP side.
        if is_recording:
            stop_fired = False
            active_phrase = (
                self._agent_phrase if self._active_mode == "agent"
                else self._dictation_phrase
            )
            if self._stop_mode in ("wake", "any") and wake_hit is not None:
                # The active mode's phrase toggles off. The stop_phrase also
                # stops. Any other wake_hit is ignored.
                if wake_hit == active_phrase or wake_hit == self._stop_phrase:
                    stop_fired = True
            if not stop_fired and self._stop_mode in ("clap", "any") and clap_hit:
                stop_fired = True

            if stop_fired:
                log_info(f"WakeListener: stop signal — ending {self._active_mode} window")
                self._end_window()
            return

        # START side.
        if not is_recording:
            new_mode: Optional[str] = None
            if self._start_mode in ("wake", "both") and wake_hit is not None:
                if wake_hit == self._agent_phrase:
                    new_mode = "agent"
                elif wake_hit == self._dictation_phrase:
                    new_mode = "dictation"
            if new_mode is None and self._start_mode in ("clap", "both") and clap_hit:
                new_mode = "dictation"   # clap defaults to dictation mode

            if new_mode is not None:
                log_info(f"WakeListener: start signal — opening {new_mode} window")
                self._begin_window(new_mode)

    def _begin_window(self, mode: str) -> None:
        self._active_mode = mode
        self._active_started_at = time.monotonic()
        try:
            self._on_start(mode)
        except Exception as exc:
            logger.exception("on_start callback raised: %s", exc)
            self._active_mode = None
            self._active_started_at = None

    def _end_window(self) -> None:
        self._active_mode = None
        self._active_started_at = None
        try:
            self._on_stop()
        except Exception as exc:
            logger.exception("on_stop callback raised: %s", exc)
        # Reset detectors so the wake-word that just ended a session
        # doesn't immediately re-fire.
        if self._wake_detector is not None:
            self._wake_detector.reset()
        if self._clap_detector is not None:
            self._clap_detector.reset()
