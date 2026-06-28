"""Thin adapter: LocalFlow agent mode → VoiceUse Brain execution.

This module is the ONLY integration surface between LocalFlow and VoiceUse.
It is imported lazily (only when agent mode is active) so dictation-only
users never need voiceuse installed.

Usage from LocalFlow's _stop_recording:
    from localflow_agent.agent_bridge import run_agent
    result = run_agent(transcript_text)
    # result = {"success": bool, "message": str, "data": dict|None}

VoiceUse stays the source of truth for all execution logic (LLM planning,
OS control, vision, safety, TTS). LocalFlow stays the source of truth for
audio capture, hotkeys, and the recording overlay.
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from typing import Any, Dict, Optional

logger = logging.getLogger("localflow.agent_bridge")

# Cache the Brain instance + persistent event loop across calls so we
# don't reconstruct the LLM client, OS controller, and TTS engine on
# every hotkey press. The persistent loop is critical: the TTS worker
# (_queue_worker) is a long-running asyncio Task that must stay alive
# on the same loop where speak() enqueues text.
_brain_instance: Any = None
_bg_loop: Optional[asyncio.AbstractEventLoop] = None
_bg_thread: Optional[threading.Thread] = None

# Default config path: ~/.localflow/voiceuse.yaml.
_DEFAULT_CONFIG_PATH = os.path.expanduser("~/.localflow/voiceuse.yaml")


def _bg_loop_runner(loop: asyncio.AbstractEventLoop) -> None:
    """Run the persistent event loop in a daemon thread."""
    asyncio.set_event_loop(loop)
    loop.run_forever()


def _get_brain(config_path: Optional[str] = None) -> Any:
    """Construct (or return cached) VoiceUse Brain with a persistent loop.

    Imports voiceuse lazily so this module is import-safe even when
    voice-computer-use-agent is not installed.
    """
    global _brain_instance, _bg_loop, _bg_thread

    if _brain_instance is not None:
        return _brain_instance

    from voiceuse.config import Config
    from voiceuse.os_controller import OSController
    from voiceuse.vision_bridge import VisionBridge
    from voiceuse.safety import SafetyGuard
    from voiceuse.tts_manager import TTSManager
    from voiceuse.brain import Brain

    cfg = Config.from_yaml(config_path) if config_path else Config()

    os_controller = OSController(config=cfg)
    vision_bridge = VisionBridge(config=cfg, os_controller=os_controller)
    safety_guard = SafetyGuard(config=cfg)
    tts_manager = TTSManager(config=cfg)

    # Create a persistent event loop running in a daemon thread. The TTS
    # worker (_queue_worker) needs this loop to stay alive so it can
    # process the speech queue when speak() is called later.
    _bg_loop = asyncio.new_event_loop()
    _bg_thread = threading.Thread(
        target=_bg_loop_runner, args=(_bg_loop,), daemon=True, name="voiceuse-loop"
    )
    _bg_thread.start()

    # Start the TTS worker on the persistent loop (blocks until started).
    future = asyncio.run_coroutine_threadsafe(tts_manager.start(), _bg_loop)
    future.result(timeout=10)

    def _get_confirmation_text(tool_name: str, parameters: dict) -> str:
        logger.info(
            "Safety confirmation requested for %s — auto-denying "
            "(no confirmation channel in LocalFlow agent mode)",
            tool_name,
        )
        return ""

    brain = Brain(
        config=cfg,
        safety=safety_guard,
        os_controller=os_controller,
        vision_bridge=vision_bridge,
        tts_manager=tts_manager,
        get_confirmation_text=_get_confirmation_text,
    )

    _brain_instance = brain
    logger.info("VoiceUse Brain initialised for LocalFlow agent mode")
    return brain


def run_agent(
    transcript: str,
    config_path: Optional[str] = None,
    ghost: bool = False,
) -> Dict[str, Any]:
    """Execute a voice command through the VoiceUse Brain pipeline.

    Called from LocalFlow's _stop_recording when agent_mode_active is True.
    Handles the async event loop internally so callers don't need asyncio.

    Args:
        transcript: The transcribed voice command text.
        config_path: Optional path to a VoiceUse config.yaml.
        ghost: When True, suppress TTS playback.

    Returns:
        Dict with keys: success, message, data.
    """
    effective_path = config_path or _DEFAULT_CONFIG_PATH
    if config_path is None and not os.path.exists(_DEFAULT_CONFIG_PATH):
        effective_path = None

    try:
        brain = _get_brain(effective_path)
    except ImportError:
        return {
            "success": False,
            "message": (
                "Voice agent mode requires voice-computer-use-agent. "
                "Install it with: pip install voice-computer-use-agent"
            ),
            "data": None,
        }
    except Exception as exc:
        logger.exception("Failed to initialise VoiceUse Brain")
        return {
            "success": False,
            "message": f"Agent initialisation failed: {exc}",
            "data": None,
        }

    # Run the Brain pipeline on the persistent background loop so the
    # TTS worker is on the same loop and can actually pick up speak() calls.
    loop = _bg_loop
    try:
        future = asyncio.run_coroutine_threadsafe(
            brain.process_command(transcript), loop
        )
        result = future.result(timeout=60)

        # Speak the response so the agent isn't a silent ghost.
        # speak() just enqueues to the asyncio queue; the worker (running
        # on the same persistent loop) picks it up and plays the audio.
        if result.success and result.message and not ghost:
            # Duck (mute) all other app audio sessions so the TTS voice
            # is clearly audible. We skip our own python process so
            # pygame's TTS playback isn't muted.
            _ducker = None
            try:
                from .audio_control import SystemAudioController
                _ducker = SystemAudioController()
                _ducker.duck_sessions()
            except Exception as duck_err:
                logger.debug("Session ducking failed (non-fatal): %s", duck_err)

            try:
                speak_future = asyncio.run_coroutine_threadsafe(
                    brain.tts_manager.speak(result.message, interrupt=True), loop
                )
                speak_future.result(timeout=5)
                # Give TTS time to synthesize+play.
                import time as _time
                _time.sleep(2.0)
            except Exception as tts_err:
                logger.debug("TTS playback failed (non-fatal): %s", tts_err)
            finally:
                # Restore the ducked sessions
                if _ducker:
                    try:
                        _ducker.unduck_sessions()
                    except Exception:
                        pass

    except Exception as exc:
        logger.exception("Agent execution failed")
        return {
            "success": False,
            "message": f"Agent execution error: {exc}",
            "data": None,
        }

    return {
        "success": result.success,
        "message": result.message,
        "data": result.data,
    }


def is_available() -> bool:
    """Check whether voiceuse is importable."""
    try:
        import voiceuse  # noqa: F401
        return True
    except ImportError:
        return False