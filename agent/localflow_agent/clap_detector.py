"""
Double-clap detector for the LocalFlow desktop agent.

This module implements a simple peak detector on the audio signal's short-
term RMS energy. It emits a ``ClapEvent`` when two peaks above a configured
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
        frame_ms: Audio frame size in ms. The detector computes RMS over
            each incoming frame. Default 20 ms (caller-agnostic).
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

        # Cooldown gate — ignore everything inside the cooldown window.
        if self._last_clap_at is not None and (now_ms - self._last_clap_at) < self._cooldown_ms:
            return None

        # Below threshold? Just age out stale peaks and return.
        if peak_db < self._threshold_db:
            self._age_peaks(now_ms)
            return None

        # Above threshold — record this peak.
        self._peak_times.append(now_ms)

        # Check if the OLDEST peak within the window makes a valid double-clap.
        # The deque is append-only and time-ordered; the oldest is the leftmost.
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
