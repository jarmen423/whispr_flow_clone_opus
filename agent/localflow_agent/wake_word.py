"""
openWakeWord-based phrase detector for the LocalFlow desktop agent.

This module wraps the openwakeword library (https://github.com/dscripka/openWakeWord)
to provide low-latency wake-phrase detection on a rolling audio stream. The
detector is intentionally thin: it owns the model lifecycle, exposes
``process_frame(audio_int16) -> dict[str, float]``, and returns the per-phrase
confidence scores for the caller to threshold.

Importing this module is safe even if openwakeword is not installed — the
class will raise a clear ImportError only when ``__init__`` runs.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

logger = logging.getLogger("localflow.wake_word")


class WakeWordDetector:
    """Thin wrapper around ``openwakeword.model.Model`` for phrase detection.

    Args:
        phrases: List of wake-phrase strings to detect (e.g.
            ``["hey computer", "okay agent"]``). Each phrase is mapped to the
            closest pre-trained openwakeword model by replacing spaces with
            underscores. The pre-trained set ships with models for common
            phrases; custom user phrases require a custom .onnx model passed
            via ``model_paths``.
        threshold: Per-phrase detection threshold (0.0 - 1.0). Default 0.5.
            The detector itself does not filter by threshold — ``process_frame``
            always returns the actual score for each phrase so the caller can
            implement hysteresis if desired.
        model_paths: Optional list of paths to custom .onnx model files.
            When None, openwakeword's pre-trained set is used.
    """

    # openwakeword's pre-trained phrases (model names, NOT user phrases).
    # The user-facing phrase "hey computer" maps to model "hey_computer" by
    # replacing spaces with underscores. If a user phrase has no pre-trained
    # match, that phrase will simply always return 0.0 from ``process_frame``
    # — it won't crash.
    PRETRAINED_PHRASES: List[str] = [
        "hey_jarvis",
        "alexa",
        "hey_mycroft",
        "hey_computer",
        "okay_agent",
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
        # (~80 ms) per frame. The caller (WakeListener) is responsible for
        # delivering the right size; we don't enforce it here.
        self._model = Model(
            wakeword_models=model_paths or self.PRETRAINED_PHRASES,
        )
        logger.info(
            "WakeWordDetector initialised: phrases=%s threshold=%.2f",
            self._phrases, self._threshold,
        )

    @property
    def phrases(self) -> List[str]:
        """Return the configured user phrases."""
        return list(self._phrases)

    def process_frame(self, audio_int16) -> Dict[str, float]:
        """Run one frame of audio through the model.

        Args:
            audio_int16: numpy.ndarray of int16 samples. For 16 kHz mono,
                a frame of 1280 samples (~80 ms) is the canonical size used
                by openwakeword. Other shapes are accepted but accuracy may
                degrade.

        Returns:
            dict mapping each configured user phrase to its current
            confidence score (0.0 - 1.0). Phrases without a matching
            pre-trained model always return 0.0.
        """
        try:
            scores = self._model.predict(audio_int16)
        except Exception as exc:
            logger.debug("WakeWordDetector.predict failed: %s", exc)
            return {p: 0.0 for p in self._phrases}

        # openwakeword returns dict[model_name, score]; map each user phrase
        # to its underscore-separated model key.
        result: Dict[str, float] = {}
        for phrase in self._phrases:
            key = phrase.replace(" ", "_")
            result[phrase] = float(scores.get(key, 0.0))
        return result

    def reset(self) -> None:
        """Reset internal state. Call when starting a new recording session.

        Useful so a wake phrase that just ended a session doesn't immediately
        re-fire on the next frame.
        """
        try:
            self._model.reset()
        except Exception:
            pass
