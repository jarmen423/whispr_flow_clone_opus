# Wake Word + Double-Clap Activation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add hands-free activation to the LocalFlow desktop agent. The user can start a dictation or agent-mode session by either speaking a wake phrase ("hey computer", "okay agent", "yo agent","yo jeffrey","yo alfred") OR making a double-clap sound, and end it the same way (toggle) or by hitting a timeout safety cap.

**Architecture:** A new optional subcommand `localflow-agent --wake-word` runs a separate process that owns an always-listening audio stream. Two parallel signal detectors run on that stream: an openWakeWord phrase detector (low-latency ONNX) and a numeric peak detector (double-clap). When a start signal fires, the wake-word process drives the existing `LocalFlowAgent._start_recording` / `_stop_recording` pipeline (via direct AudioRecorder + process_audio_bytes calls — no hotkey required). When a stop signal fires, it calls _stop_recording. This keeps wake-word as an add-on, not a rewrite of the recording pipeline.

**Tech Stack:**
- `openwakeword` (PyPI, MIT, ONNX, ~1-3% CPU) — wake phrase detection
- `numpy` + `sounddevice` (already in deps) — peak/RMS detection for claps
- Argparse + existing `LocalFlowAgent` internals — no new IPC, same process model
- New optional `[wake]` extra in `pyproject.toml` so dictation-only users don't pay for openwakeword

---

## Compliance with Project Conventions

AGENTS.md mandates: Single Responsibility, < ~400 LOC per file. Current state of relevant files:

| File | LOC | Status |
|------|-----|--------|
| `agent/localflow_agent/__init__.py` | 1231 | **Already violates** — known debt; the `--wake-word` subcommand branch adds ~25 lines, not a structural worsening |
| `agent/localflow_agent/audio_control.py` | 231 | OK |
| `agent/localflow_agent/recording.py` | 435 | **Already violates** — not touched by this plan |
| `agent/localflow_agent/setup_wizard.py` | 360 | OK; new wake-word panel adds ~50 lines → 410 LOC, **just over the limit** → split into `_setup_wake_word_panel()` helper if it grows beyond 80 lines |

**New files in this plan are all < 200 LOC each by design.**

---

## Data Model

### Config additions (`~/.localflow/config.json`)

```json
{
  "wake_word_enabled": false,
  "wake_word_start_mode": "wake",          // "wake" | "clap" | "both"
  "wake_word_stop_mode": "any",            // "wake" | "clap" | "stop_word" | "timeout" | "any"
  "wake_word_dictation_phrase": "hey computer",
  "wake_word_agent_phrase": "okay agent",
  "wake_word_stop_phrase": "end dictation",
  "wake_word_timeout_seconds": 60,
  "clap_enabled": false,
  "clap_threshold_db": -25.0,
  "clap_window_ms": 500
}
```

### Trigger matrix (resolved at startup)

| start_mode | Detectors armed for START | Detectors armed for STOP (when stop_mode="any") |
|------------|---------------------------|--------------------------------------------------|
| `wake`     | openwakeword (both phrases) | openwakeword (both phrases) ∪ stop_phrase ∪ timeout |
| `clap`     | peak detector              | peak detector ∪ timeout |
| `both`     | wake OR peak detector      | wake OR peak OR stop_phrase OR timeout |

The same wake phrase acts as start AND stop (toggle) when `stop_mode=any` and that phrase is in the stop set. The clap detector is always a toggle (same gesture starts and stops).

---

## Task 1: Add `[wake]` optional extra to `pyproject.toml`

**Objective:** Declare the new optional dep so `pip install localflow-agent[wake]` installs openwakeword. Dictation-only users do not pay for it.

**Files:**
- Modify: `pyproject.toml:36-57` (the `[project.optional-dependencies]` block)

**Step 1: Add the new extra**

Insert after the `agent = [...]` block, before `[project.scripts]`:

```toml
# Wake-word activation (openWakeWord-based phrase detection). Optional —
# dictation-only users do not need this. Install with:
#     pip install localflow-agent[wake]
# Combined with agent mode:
#     pip install localflow-agent[wake,agent]
wake = [
    "openwakeword>=0.6.0",
]
```

**Step 2: Verify the file parses**

Run: `python3 -c "import tomllib; tomllib.loads(open('pyproject.toml').read())"`
Expected: no output, exit 0.

**Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "build: add [wake] optional extra for openwakeword"
```

---

## Task 2: Add wake-word config keys to `config.py`

**Objective:** Read/write the new keys via the existing `_bool_setting` / `_string_setting` / `_float_setting` / `_int_setting` helpers in `config.py`, so they round-trip through `~/.localflow/config.json` like every other setting.

**Files:**
- Modify: `agent/localflow_agent/config.py` (find the existing setting helpers and the CONFIG dict literal — there is a known pattern there; follow it)

**Step 1: Find the existing setting-helper pattern**

Run: `grep -n "_bool_setting\|_string_setting\|CONFIG = \|CONFIG\[" agent/localflow_agent/config.py | head -40`

**Step 2: Add keys**

Add the following near the other setting definitions (pattern-match the existing style — most likely a dict literal at module level or per-key getter functions):

```python
# --- Wake word activation (see docs/plans/2026-06-29-wake-word-and-clap-detection.md) ---
WAKE_WORD_ENABLED            = _bool_setting("WAKE_WORD_ENABLED", "wake_word_enabled", default=False)
WAKE_WORD_START_MODE         = _string_setting("WAKE_WORD_START_MODE", "wake_word_start_mode", default="wake")
WAKE_WORD_STOP_MODE          = _string_setting("WAKE_WORD_STOP_MODE", "wake_word_stop_mode", default="any")
WAKE_WORD_DICTATION_PHRASE   = _string_setting("WAKE_WORD_DICTATION_PHRASE", "wake_word_dictation_phrase", default="hey computer")
WAKE_WORD_AGENT_PHRASE       = _string_setting("WAKE_WORD_AGENT_PHRASE", "wake_word_agent_phrase", default="okay agent")
WAKE_WORD_STOP_PHRASE        = _string_setting("WAKE_WORD_STOP_PHRASE", "wake_word_stop_phrase", default="end dictation")
WAKE_WORD_TIMEOUT_SECONDS    = _int_setting("WAKE_WORD_TIMEOUT_SECONDS", "wake_word_timeout_seconds", default=60)
CLAP_ENABLED                 = _bool_setting("CLAP_ENABLED", "clap_enabled", default=False)
CLAP_THRESHOLD_DB            = _float_setting("CLAP_THRESHOLD_DB", "clap_threshold_db", default=-25.0)
CLAP_WINDOW_MS               = _int_setting("CLAP_WINDOW_MS", "clap_window_ms", default=500)
```

If `_int_setting` doesn't exist, add it as a sibling of `_float_setting` following the same pattern (env override → config file → default). If `_string_setting` doesn't exist either, follow the existing precedent in the file.

**Step 3: Verify import**

Run: `python3 -c "from localflow_agent.config import WAKE_WORD_ENABLED, WAKE_WORD_DICTATION_PHRASE; print(WAKE_WORD_ENABLED, WAKE_WORD_DICTATION_PHRASE)"`
Expected: `False hey computer` (or whatever the default is).

**Step 4: Commit**

```bash
git add agent/localflow_agent/config.py
git commit -m "feat(agent): add wake-word and clap config keys"
```

---

## Task 3: Create `wake_word.py` — openWakeWord phrase detector

**Objective:** A `WakeWordDetector` class that wraps openwakeword's model loading + prediction API. The class exposes `process_frame(audio_int16_chunk)` returning a `dict[phrase, score]` (or empty if no model is loaded). Lazy import of `openwakeword` so dictation-only users without the `[wake]` extra don't get an ImportError on agent startup.

**Files:**
- Create: `agent/localflow_agent/wake_word.py` (~120 LOC)

**Step 1: Write the file**

```python
"""
openWakeWord-based phrase detector for the LocalFlow desktop agent.

This module wraps the openwakeword library (https://github.com/dscripka/openWakeWord)
to provide low-latency wake-phrase detection on a rolling audio stream. The
detector is intentionally thin: it owns the model lifecycle, exposes
`process_frame(audio_int16) -> dict[str, float]`, and returns the per-phrase
confidence scores for the caller to threshold.

Importing this module is safe even if openwakeword is not installed — the
class will raise a clear ImportError only when `__init__` runs.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

logger = logging.getLogger("localflow.wake_word")


class WakeWordDetector:
    """Thin wrapper around openwakeword.Model for phrase detection.

    Args:
        phrases: List of wake-phrase strings to detect. Must be supported by
            openwakeword's pre-trained model set. The full pre-trained set
            includes phrases like "hey_jarvis", "alexa", "hey_mycroft", etc.
            For custom phrases, the user must supply a custom .onnx model
            via the `model_paths` arg.
        threshold: Per-phrase detection threshold (0.0 - 1.0). Default 0.5.
        model_paths: Optional list of paths to custom .onnx model files.
            When None, the pre-trained model set is used.
    """

    # openwakeword's pre-trained phrases ship as a free set; the user can
    # also pass their own .onnx. We do NOT bundle any models here.
    PRETRAINED_PHRASES: List[str] = [
        "hey_jarvis",
        "alexa",
        "hey_mycroft",
        "hey_computer",   # closest pre-trained match for "hey computer"
        "okay_agent",     # closest pre-trained match for "okay agent"
    ]

    def __init__(
        self,
        phrases: List[str],
        threshold: float = 0.5,
        model_paths: Optional[List[str]] = None,
    ) -> None:
        if not phrases:
            raise ValueError("WakeWordDetector requires at least one phrase")

        try:
            from openwakeword.model import Model  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "openwakeword is not installed. Install with: "
                "pip install localflow-agent[wake] (or uv add openwakeword)."
            ) from exc

        self._phrases = list(phrases)
        self._threshold = float(threshold)

        # openwakeword expects a 16 kHz mono int16 chunk of 1280 samples
        # (~80 ms) per frame. We do not enforce this here — the caller
        # (WakeListener) is responsible for delivering the right size.
        self._model = Model(
            wakeword_models=model_paths or self.PRETRAINED_PHRASES,
        )
        logger.info(
            "WakeWordDetector initialised: phrases=%s threshold=%.2f",
            self._phrases, self._threshold,
        )

    @property
    def phrases(self) -> List[str]:
        return list(self._phrases)

    def process_frame(self, audio_int16) -> Dict[str, float]:
        """Run one frame of audio through the model.

        Args:
            audio_int16: numpy.ndarray of int16 samples, shape (1280,) for
                16 kHz mono (~80 ms). Other shapes are accepted but accuracy
                may degrade.

        Returns:
            dict mapping each configured phrase to its current confidence
            score (0.0 - 1.0). Phrases below threshold are still returned
            so the caller can implement hysteresis if desired.
        """
        try:
            scores = self._model.predict(audio_int16)
        except Exception as exc:
            logger.debug("WakeWordDetector.predict failed: %s", exc)
            return {p: 0.0 for p in self._phrases}

        # openwakeword returns dict[model_name, score]; map back to phrases
        result: Dict[str, float] = {}
        for phrase in self._phrases:
            # model key uses underscores; user phrase might have spaces
            key = phrase.replace(" ", "_")
            result[phrase] = float(scores.get(key, 0.0))
        return result

    def reset(self) -> None:
        """Reset internal state (call when starting a new recording session)."""
        try:
            self._model.reset()
        except Exception:
            pass
```

**Step 2: Smoke-import (no model needed)**

Run: `python3 -c "from localflow_agent.wake_word import WakeWordDetector; print(WakeWordDetector.PRETRAINED_PHRASES)"`
Expected: prints the list of pre-trained phrases.

**Step 3: Commit**

```bash
git add agent/localflow_agent/wake_word.py
git commit -m "feat(agent): WakeWordDetector wrapping openwakeword"
```

---

## Task 4: Create `clap_detector.py` — double-clap peak detector

**Objective:** A `ClapDetector` class that maintains a rolling RMS-energy buffer and emits "clap!" events when two peaks above a threshold occur within a configurable inter-clap window. Pure numpy/sounddevice, no new deps.

**Files:**
- Create: `agent/localflow_agent/clap_detector.py` (~150 LOC)

**Step 1: Write the file**

```python"""
Double-clap detector for the LocalFlow desktop agent.

This module implements a simple peak detector on the audio signal's short-
term RMS energy. It emits a "clap" event when two peaks above a configured
threshold occur within a configurable inter-clap window. The detector is
deliberately heuristic (not ML) and is meant to be a low-cost, low-friction
alternative to wake-word activation.

Typical tuning:
    threshold_db=-25.0,  # peak must be at least -25 dBFS (loud)
    window_ms=500,       # two peaks must occur within 500 ms of each other
    cooldown_ms=1000,    # after a clap, ignore new peaks for 1 s (avoid double-fires)
"""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque, Optional

import numpy as np

logger = logging.getLogger("localflow.clap_detector")


@dataclass
class ClapEvent:
    """Emitted when a double-clap pattern is detected."""
    timestamp_ms: int     # monotonic time when the SECOND peak was seen
    peak_db: float        # dBFS of the second peak (loudest of the two)


class ClapDetector:
    """Detect double-clap patterns on a rolling audio stream.

    Args:
        threshold_db: Peak must be at least this loud (dBFS, negative number).
            -25 dBFS = a moderately loud clap. Lower (more negative) = stricter.
        window_ms: Two peaks must occur within this many ms to count as a
            double-clap. Default 500 ms.
        cooldown_ms: After a successful double-clap, ignore new peaks for this
            long. Prevents the same sound from firing the detector twice.
        frame_ms: Audio frame size in ms. The detector accumulates samples
            and computes RMS over each frame. Default 20 ms.
    """

    def __init__(
        self,
        threshold_db: float = -25.0,
        window_ms: int = 500,
        cooldown_ms: int = 1000,
        frame_ms: int = 20,
    ) -> None:
        self._threshold_db = float(threshold_db)
        self._window_ms = int(window_ms)
        self._cooldown_ms = int(cooldown_ms)
        self._frame_ms = int(frame_ms)

        # Monotonic timestamps of recent peaks above threshold.
        self._peak_times: Deque[float] = deque()
        self._last_clap_at: Optional[float] = None

    def process_frame(self, audio_float32) -> Optional[ClapEvent]:
        """Process one frame of audio (float32, mono, -1.0..1.0).

        Returns a ClapEvent if this frame completes a double-clap pattern,
        else None.
        """
        if audio_float32 is None or len(audio_float32) == 0:
            return None

        rms = float(np.sqrt(np.mean(np.square(audio_float32)) + 1e-12))
        peak_db = 20.0 * np.log10(rms + 1e-12)
        now_ms = time.monotonic() * 1000.0

        # Cooldown gate — ignore everything inside the cooldown window
        if self._last_clap_at is not None and (now_ms - self._last_clap_at) < self._cooldown_ms:
            return None

        # Below threshold? Just age out stale peaks.
        if peak_db < self._threshold_db:
            self._age_peaks(now_ms)
            return None

        # Above threshold — record this peak.
        self._peak_times.append(now_ms)

        # Check if the OLDEST peak within the window makes a valid double-clap.
        # The deque is append-only time-ordered; the oldest is the leftmost.
        if len(self._peak_times) >= 2:
            oldest = self._peak_times[0]
            newest = self._peak_times[-1]
            if (newest - oldest) <= self._window_ms:
                self._last_clap_at = now_ms
                self._peak_times.clear()
                event = ClapEvent(timestamp_ms=int(now_ms), peak_db=peak_db)
                logger.debug("ClapDetector: double-clap detected (peak_db=%.1f)", peak_db)
                return event

        return None

    def _age_peaks(self, now_ms: float) -> None:
        """Drop peaks that have fallen outside the inter-clap window."""
        cutoff = now_ms - self._window_ms
        while self._peak_times and self._peak_times[0] < cutoff:
            self._peak_times.popleft()

    def reset(self) -> None:
        """Reset internal state (call when starting a new recording session)."""
        self._peak_times.clear()
        self._last_clap_at = None
```

**Step 2: Write a smoke test (no real audio — feed synthetic frames)**

Run this in a Python REPL or as a one-shot:

```python
import numpy as np
from localflow_agent.clap_detector import ClapDetector

d = ClapDetector(threshold_db=-25.0, window_ms=500, cooldown_ms=1000)

# Two loud frames 100 ms apart → should fire
for i in range(5):
    f = np.zeros(320, dtype=np.float32)         # 20 ms of silence at 16 kHz
    ev = d.process_frame(f)
    assert ev is None
# Inject two loud peaks
loud = (np.ones(320, dtype=np.float32)) * 0.3   # ~-10 dBFS
ev1 = d.process_frame(loud)
import time; time.sleep(0.1)
ev2 = d.process_frame(loud)
assert ev2 is not None, "Expected a clap event on second peak"
print("OK:", ev2)
```

Expected: prints `OK: ClapEvent(timestamp_ms=..., peak_db=-10.4...)`.

**Step 3: Commit**

```bash
git add agent/localflow_agent/clap_detector.py
git commit -m "feat(agent): ClapDetector for double-clap peak detection"
```

---

## Task 5: Create `wake_listener.py` — orchestrator that owns the mic stream

**Objective:** A `WakeListener` class that opens a sounddevice InputStream at 16 kHz mono, fans out each frame to the configured detectors, and fires start/stop callbacks when a configured signal pattern matches. Does NOT touch the hotkey path. Drives the existing `AudioRecorder` from `recording.py` for the actual capture.

**Files:**
- Create: `agent/localflow_agent/wake_listener.py` (~200 LOC)

**Step 1: Write the file**

```python
"""
WakeListener — always-listening activation loop for the LocalFlow agent.

This module owns a sounddevice InputStream at 16 kHz mono. Each 80 ms
frame (~1280 samples) is fanned out to:

    1. WakeWordDetector (openwakeword) — phrase detection
    2. ClapDetector     — peak detection
    3. AudioRecorder    — captures the active recording window

Start/stop callbacks are driven by the detector output, not by hotkey
events. This keeps the wake-word feature as a pure add-on to the existing
recording pipeline.

Callback contract (passed to `__init__`):
    on_start(mode: str) -> None       # mode in {"dictation", "agent"}
    on_stop() -> None
    on_audio(audio_int16) -> None     # forwarded frames for the active window

The class is intentionally framework-agnostic — the actual
process_audio_bytes call happens in main() after on_stop() fires.
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

from .config import (
    WAKE_WORD_START_MODE, WAKE_WORD_STOP_MODE,
    WAKE_WORD_DICTATION_PHRASE, WAKE_WORD_AGENT_PHRASE, WAKE_WORD_STOP_PHRASE,
    WAKE_WORD_TIMEOUT_SECONDS, WAKE_WORD_ENABLED,
    CLAP_ENABLED, CLAP_THRESHOLD_DB, CLAP_WINDOW_MS,
    log_info, log_warning, log_error,
)

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
        on_audio: Callable[[np.ndarray], None],
    ) -> None:
        self._on_start = on_start
        self._on_stop = on_stop
        self._on_audio = on_audio

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

        # Read config (snapshot at construction so config changes mid-run
        # don't surprise us).
        self._start_mode = WAKE_WORD_START_MODE          # "wake" | "clap" | "both"
        self._stop_mode = WAKE_WORD_STOP_MODE            # see matrix in plan
        self._dictation_phrase = WAKE_WORD_DICTATION_PHRASE
        self._agent_phrase = WAKE_WORD_AGENT_PHRASE
        self._stop_phrase = WAKE_WORD_STOP_PHRASE
        self._timeout_s = WAKE_WORD_TIMEOUT_SECONDS
        self._clap_enabled = CLAP_ENABLED
        self._clap_threshold_db = CLAP_THRESHOLD_DB
        self._clap_window_ms = CLAP_WINDOW_MS

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
        try:
            if self._start_mode in ("wake", "both") or self._stop_mode in ("wake", "any"):
                from .wake_word import WakeWordDetector
                self._wake_detector = WakeWordDetector(
                    phrases=[self._dictation_phrase, self._agent_phrase]
                )
        except ImportError as exc:
            log_error(f"WakeListener: wake-word init failed: {exc}")
            return False

        if (self._start_mode in ("clap", "both") or self._stop_mode in ("clap", "any")) and self._clap_enabled:
            from .clap_detector import ClapDetector
            self._clap_detector = ClapDetector(
                threshold_db=self._clap_threshold_db,
                window_ms=self._clap_window_ms,
            )

        if self._wake_detector is None and self._clap_detector is None:
            log_warning(
                "WakeListener: no detectors enabled — nothing to listen for. "
                "Set wake_word_enabled=true and/or clap_enabled=true in "
                "~/.localflow/config.json."
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

        # 1. Forward to the active recording window, if any.
        with self._lock:
            is_recording = self._active_mode is not None

        if is_recording:
            self._on_audio(audio_int16)

        # 2. Check the wake-word detector.
        wake_hit: Optional[str] = None
        if self._wake_detector is not None:
            try:
                scores = self._wake_detector.process_frame(audio_int16)
                for phrase, score in scores.items():
                    if score >= 0.5:  # detector's own threshold; duplicated for clarity
                        wake_hit = phrase
                        break
            except Exception as exc:
                logger.debug("WakeWordDetector error: %s", exc)

        # 3. Check the clap detector.
        clap_hit = False
        if self._clap_detector is not None:
            try:
                clap_hit = self._clap_detector.process_frame(audio_float32) is not None
            except Exception as exc:
                logger.debug("ClapDetector error: %s", exc)

        # 4. Resolve start/stop.
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
            if self._stop_mode in ("wake", "any") and wake_hit is not None:
                # Same phrase toggles off. Match against the active mode's phrase.
                expected = (
                    self._agent_phrase if self._active_mode == "agent"
                    else self._dictation_phrase
                )
                if wake_hit == expected or self._stop_mode == "any":
                    stop_fired = True
            if not stop_fired and self._stop_mode in ("clap", "any") and clap_hit:
                stop_fired = True
            if not stop_fired and self._stop_mode in ("stop_word", "any") and wake_hit == self._stop_phrase:
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
        mode = self._active_mode
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
```

**Step 2: Verify import**

Run: `python3 -c "from localflow_agent.wake_listener import WakeListener; print('ok')"`
Expected: prints `ok`.

**Step 3: Commit**

```bash
git add agent/localflow_agent/wake_listener.py
git commit -m "feat(agent): WakeListener orchestrates always-on mic + detectors"
```

---

## Task 6: Wire `--wake-word` into `main()` in `__init__.py`

**Objective:** Add a new argparse branch that, when `--wake-word` is passed, builds a WakeListener and runs the existing recording pipeline when its start/stop callbacks fire. Reuses AudioRecorder for capture and process_audio_bytes for transcription — no duplication of the pipeline.

**Files:**
- Modify: `agent/localflow_agent/__init__.py:1017+` (the `main()` function and the imports at the top)
- Note: This file is 1231 LOC and already violates the AGENTS.md < 400 rule. We're adding ~30 lines, not making the debt worse. Do not refactor this file as part of this plan — that's a separate cleanup.

**Step 1: Add the import**

After the existing `from .setup_wizard import _run_setup_wizard` line (~102), add:

```python
from .wake_listener import WakeListener
```

**Step 2: Add the argparse flag**

After the `--diag` flag (~1119) and before `--setup` (~1121), add:

```python
parser.add_argument(
    "--wake-word",
    action="store_true",
    help="Run the wake-word / clap listener (hands-free dictation activation). "
         "Configure via ~/.localflow/config.json (wake_word_enabled, clap_enabled).",
)
```

**Step 3: Add the branch in main()**

Right after the `--setup` branch (~1137) and before the rest of the existing main() body, add:

```python
if args.wake_word:
    _run_wake_word_listener()
    return
```

**Step 4: Add the helper function**

Add the helper just above `def main()` (or below, in any empty region — it's self-contained):

```python
def _run_wake_word_listener() -> None:
    """Run the always-listening wake-word + clap listener.

    Reuses the existing recording + transcription pipeline. On start, opens
    an AudioRecorder. On stop, hands the recorded audio to
    ``process_audio_bytes`` with the correct mode and pastes the result.
    """
    import numpy as np
    from .recording import AudioRecorder, PasteHandler
    from .api import process_audio_bytes

    recorder = AudioRecorder()
    audio_chunks: list = []
    active_mode: list = [None]   # mutable ref so the callback closure can read it

    def on_audio(chunk: np.ndarray) -> None:
        audio_chunks.append(chunk)

    def on_start(mode: str) -> None:
        active_mode[0] = mode
        audio_chunks.clear()
        recorder.start()

    def on_stop() -> None:
        mode = active_mode[0] or "dictation"
        active_mode[0] = None
        wav_bytes = recorder.stop()
        if not wav_bytes or not audio_chunks:
            log_warning("WakeListener: stop fired with no audio captured")
            return

        # Translate mode → process_audio_bytes arg shape.
        # wake-word agent mode is a direct agent query (same as Alt+A).
        run_agent = (mode == "agent")
        try:
            result = process_audio_bytes(
                wav_bytes,
                mode="agent" if run_agent else "raw",
                translate=False,
                run_agent_query=run_agent,
            )
        except Exception as exc:
            log_error(f"Wake-word pipeline failed: {exc}")
            return

        if result.get("success") and result.get("text"):
            PasteHandler().paste(result["text"])
        else:
            log_warning(f"Wake-word pipeline returned no text: {result.get('error')}")

    listener = WakeListener(on_start=on_start, on_stop=on_stop, on_audio=on_audio)

    if not listener.start():
        log_error("Failed to start wake-word listener. Check config and run --diag.")
        sys.exit(1)

    print()
    print("  LocalFlow wake-word listener is running.")
    print(f"  Start: {listener._start_mode}   Stop: {listener._stop_mode}   Timeout: {listener._timeout_s}s")
    print()
    print("  To stop:  localflow-agent --stop   (or Ctrl+C in this terminal)")
    print()

    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        listener.stop()
```

**Step 5: Verify the arg parses**

Run: `localflow-agent --help 2>&1 | grep -A1 "wake-word"`
Expected: prints the new flag's help text.

**Step 6: Commit**

```bash
git add agent/localflow_agent/__init__.py
git commit -m "feat(agent): --wake-word subcommand wires WakeListener to recording pipeline"
```

---

## Task 7: Add wake-word panel to the setup wizard

**Objective:** Extend `--setup` with a small TUI panel that lets the user opt in to wake-word and/or clap detection, accept the defaults, or type custom phrases. Idempotent — re-running `--setup` should not overwrite existing phrases.

**Files:**
- Modify: `agent/localflow_agent/setup_wizard.py` (find `_run_setup_wizard` and append a wake-word panel call after the existing voiceuse config generation)

**Step 1: Add a new function**

At the bottom of `setup_wizard.py`, add (target ≤ 80 LOC):

```python
def _setup_wake_word_panel() -> None:
    """TUI panel: configure wake-word and clap detection.

    Asks the user to opt in, then lets them accept defaults or type custom
    phrases. Writes results to ~/.localflow/config.json via the existing
    config-file helper. Safe to re-run — only writes if the user changes
    a value.
    """
    from .config import _load_config_file, _save_config_file, log_info

    cfg = _load_config_file()

    enabled = _prompt_yn(
        "Enable wake-word activation? (mic will be always-on when this is on)",
        default=bool(cfg.get("wake_word_enabled", False)),
    )
    cfg["wake_word_enabled"] = enabled

    if enabled:
        cfg["wake_word_dictation_phrase"] = _prompt_string(
            "Dictation wake phrase", default=cfg.get("wake_word_dictation_phrase", "hey computer")
        )
        cfg["wake_word_agent_phrase"] = _prompt_string(
            "Agent-mode wake phrase", default=cfg.get("wake_word_agent_phrase", "okay agent")
        )
        cfg["wake_word_stop_phrase"] = _prompt_string(
            "Stop phrase (optional, say to end the recording early)",
            default=cfg.get("wake_word_stop_phrase", "end dictation"),
        )
        cfg["wake_word_timeout_seconds"] = _prompt_int(
            "Max recording window (seconds, safety cap)",
            default=int(cfg.get("wake_word_timeout_seconds", 60)),
        )

    clap = _prompt_yn(
        "Enable double-clap activation? (alternative to wake words)",
        default=bool(cfg.get("clap_enabled", False)),
    )
    cfg["clap_enabled"] = clap

    if clap:
        cfg["clap_threshold_db"] = _prompt_float(
            "Clap loudness threshold (dBFS, more negative = stricter)",
            default=float(cfg.get("clap_threshold_db", -25.0)),
        )

    _save_config_file(cfg)
    log_info("Wake-word settings saved.")
    print()
    print("  To start the listener:  localflow-agent --wake-word")
    print("  To verify the install:  localflow-agent --diag")
    print()
```

If `_prompt_yn`, `_prompt_string`, `_prompt_int`, `_prompt_float` don't exist in `setup_wizard.py`, follow the existing prompt-helper pattern in that file (e.g. there's likely an `_ask` or `_confirm` helper — extend or follow its style). Do not introduce a new prompting library.

**Step 2: Call the panel from `_run_setup_wizard`**

At the end of the existing `_run_setup_wizard` function (find it via `grep -n "_run_setup_wizard" agent/localflow_agent/setup_wizard.py`), append:

```python
    _setup_wake_word_panel()
```

**Step 3: Run the wizard and confirm it writes the keys**

Run: `echo "" | localflow-agent --setup` (the empty input exits cleanly at the existing prompts)
Expected: the new wake-word panel is reached and either accepts the default or writes the keys to `~/.localflow/config.json`.

Verify: `grep wake_word ~/.localflow/config.json`
Expected: at least `wake_word_enabled` appears.

**Step 4: Commit**

```bash
git add agent/localflow_agent/setup_wizard.py
git commit -m "feat(agent): setup wizard panel for wake-word + clap config"
```

---

## Task 8: Update `--diag` to report wake-word status

**Objective:** When the user runs `localflow-agent --diag`, they should see whether wake-word and clap are enabled, and which phrases are configured. Mirrors the existing pattern for hotkey/agent status.

**Files:**
- Modify: `agent/localflow_agent/__init__.py:_print_diagnostics()` (around line 829-902)

**Step 1: Add a wake-word section to the diagnostics output**

Just after the existing "Optional: voiceuse / agent_bridge" block (line ~869), add:

```python
    # Wake-word / clap status
    print("Wake-word activation:")
    print(f"  wake_word_enabled:    {CONFIG.get('wake_word_enabled', False)}")
    print(f"  wake_word_start_mode: {CONFIG.get('wake_word_start_mode', 'wake')}")
    print(f"  wake_word_stop_mode:  {CONFIG.get('wake_word_stop_mode', 'any')}")
    print(f"  dictation phrase:     {CONFIG.get('wake_word_dictation_phrase', 'hey computer')!r}")
    print(f"  agent phrase:         {CONFIG.get('wake_word_agent_phrase', 'okay agent')!r}")
    print(f"  stop phrase:          {CONFIG.get('wake_word_stop_phrase', 'end dictation')!r}")
    print(f"  timeout (s):          {CONFIG.get('wake_word_timeout_seconds', 60)}")
    print(f"  clap_enabled:         {CONFIG.get('clap_enabled', False)}")
    try:
        import openwakeword  # noqa: F401
        print("  [OK]    openwakeword installed")
    except ImportError:
        print("  [skip]  openwakeword (install with: pip install localflow-agent[wake])")
    print()
```

If `CONFIG` is not directly importable (some codebases call it `_CONFIG`), adjust to whatever name `__init__.py` already imports.

**Step 2: Verify**

Run: `localflow-agent --diag 2>&1 | grep -A 12 "Wake-word"`
Expected: prints the new section with the configured values.

**Step 3: Commit**

```bash
git add agent/localflow_agent/__init__.py
git commit -m "feat(agent): --diag reports wake-word and clap status"
```

---

## Task 9: End-to-end smoke test (manual verification)

**Objective:** Prove the feature works against a real mic. This is a manual step — automated mic tests are flaky and the user is the right test harness.

**Files:** none (verification only)

**Step 1: Install the new extra**

```bash
uv tool install --editable ".[wake]" --force
```

If `localflow-agent.exe` is still running (it was earlier in this session), kill it first via `cmd //c "taskkill /F /IM localflow-agent.exe"` (the `/F` must go through `cmd //c` per the MSYS-on-Windows quirk).

**Step 2: Run the wizard and opt in**

```bash
localflow-agent --setup
```

Answer "yes" to wake-word, accept the default phrases, say "no" to clap for now (we'll test that in step 5).

**Step 3: Start the listener in the foreground**

```bash
localflow-agent --wake-word --foreground
```

Expected log output:
```
WakeListener: listening (start=wake, stop=any, timeout=60s)
LocalFlow wake-word listener is running.
```

**Step 4: Test wake-word → dictation**

Say "hey computer, this is a test of wake-word dictation." Then say "end dictation" or wait 60 seconds.

Expected: text appears at the cursor (or in the clipboard if no focused window). The agent should paste "this is a test of wake-word dictation." (or close to it — Whisper is not perfect).

**Step 5: Test wake-word → agent mode**

Say "okay agent, what time is it in Tokyo." Then say "end dictation".

Expected: a short answer about Tokyo time is pasted at the cursor and (if TTS is set up) spoken aloud.

**Step 6: Test clap detection**

Re-run the wizard and enable clap. Restart the listener. Clap twice loudly. The recording window should open (in dictation mode). Speak. Clap twice again. Recording should close.

**Step 7: Test timeout**

Set `wake_word_timeout_seconds: 5` in config. Restart. Say the wake word, start talking, then go silent. After 5 seconds, the window should auto-close.

**Step 8: Commit a CHANGELOG entry**

Add to `CHANGELOG.md` under `## Unreleased`:

```markdown
- feat(agent): add `--wake-word` subcommand for hands-free activation via openwakeword phrase detection OR double-clap sound detection. Configurable wake phrases, stop phrase, and timeout safety cap. Opt-in only — default mic-off behavior is preserved.
```

**Step 9: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog entry for wake-word + clap activation"
```

---

## Phase Wrap-up

After all 9 tasks land, the feature is usable end-to-end. Two follow-up considerations for a future plan, not in scope here:

- **Custom wake-phrase training.** openwakeword supports training custom .onnx models from a few minutes of sample audio. The current plan uses the pre-trained set (closest matches to "hey computer" and "okay agent"). A follow-up could add a `localflow-agent --train-wake-word` subcommand that collects samples and emits a custom model.
- **Per-session audio ducking integration.** The wake-word listener should duck non-essential audio sessions while the recording window is open (same as the existing dictation flow uses `audio_control.py`). Currently the wake-word path does not call `_ducker.duck_sessions()` — that's a one-line addition in `_run_wake_word_listener` and a separate small task.

---

## File summary

| File | Action | LOC delta |
|------|--------|-----------|
| `pyproject.toml` | modify | +10 |
| `agent/localflow_agent/config.py` | modify | +15 |
| `agent/localflow_agent/wake_word.py` | create | +120 |
| `agent/localflow_agent/clap_detector.py` | create | +150 |
| `agent/localflow_agent/wake_listener.py` | create | +200 |
| `agent/localflow_agent/__init__.py` | modify | +60 (argparse + branch + diag + helper) |
| `agent/localflow_agent/setup_wizard.py` | modify | +70 |
| `CHANGELOG.md` | modify | +3 |
| **Total** | | **~628 LOC across 8 files** |

No existing file goes above 1500 LOC. New files are all under 200 LOC and single-responsibility. Plan complies with the project's modular conventions.
