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
from typing import Any, Dict, Optional

logger = logging.getLogger("localflow.agent_bridge")

# Cache the Brain instance across calls so we don't reconstruct the LLM
# client, OS controller, and TTS engine on every hotkey press.
_brain_instance: Any = None

# Default config path: ~/.localflow/voiceuse.yaml. The setup wizard
# creates this if the user opts into the voice-agent extra. If the file
# is missing, VoiceUse falls back to its built-in defaults (which read
# API keys from environment variables).
_DEFAULT_CONFIG_PATH = os.path.expanduser("~/.localflow/voiceuse.yaml")


def _get_brain(config_path: Optional[str] = None) -> Any:
    """Construct (or return cached) VoiceUse Brain with all subsystems.

    Imports voiceuse lazily so this module is import-safe even when
    voice-computer-use-agent is not installed.
    """
    global _brain_instance
    if _brain_instance is not None:
        return _brain_instance

    from voiceuse.config import Config
    from voiceuse.os_controller import OSController
    from voiceuse.vision_bridge import VisionBridge
    from voiceuse.safety import SafetyGuard
    from voiceuse.tts_manager import TTSManager
    from voiceuse.brain import Brain

    # Load VoiceUse config from YAML if available, otherwise use defaults.
    # API keys resolve from environment variables via pydantic validators.
    cfg = Config.from_yaml(config_path) if config_path else Config()

    os_controller = OSController(config=cfg)
    vision_bridge = VisionBridge(config=cfg, os_controller=os_controller)
    safety_guard = SafetyGuard(config=cfg)
    tts_manager = TTSManager(config=cfg)

    # TTSManager.start() is async (starts the playback loop). Run it once
    # during brain construction.
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(tts_manager.start())
    finally:
        loop.close()

    # Confirmation callback: in LocalFlow context there's no wake-word/STT
    # confirmation loop available. Return empty string (deny) so destructive
    # actions are blocked unless the user re-enables them in VoiceUse config.
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


def run_agent(transcript: str, config_path: Optional[str] = None) -> Dict[str, Any]:
    """Execute a voice command through the VoiceUse Brain pipeline.

    Called from LocalFlow's _stop_recording when agent_mode_active is True.
    Handles the async event loop internally so callers don't need asyncio.

    Args:
        transcript: The transcribed voice command text.
        config_path: Optional path to a VoiceUse config.yaml. If not
            provided, defaults to ~/.localflow/voiceuse.yaml (created
            by the setup wizard if the user opted into the voice-agent
            extra). If that file is missing too, VoiceUse's built-in
            defaults are used.

    Returns:
        Dict with keys:
            success (bool): Whether the command executed successfully.
            message (str): Human-readable result or error message.
            data (dict|None): Additional structured data from the result.
    """
    # Resolve the config path: explicit arg wins, then ~/.localflow/voiceuse.yaml
    effective_path = config_path or _DEFAULT_CONFIG_PATH
    if config_path is None and not os.path.exists(_DEFAULT_CONFIG_PATH):
        # Let VoiceUse use its built-in defaults (which read from env vars)
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

    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(brain.process_command(transcript))

        # Speak the response so the agent isn't a silent ghost.
        # The TTS manager is async (edge-tts queue worker), so we call
        # speak() on the same loop and then keep the loop alive briefly
        # so the audio actually plays before we tear it down.
        if result.success and result.message:
            try:
                loop.run_until_complete(
                    brain.tts_manager.speak(result.message, interrupt=True)
                )
                # Give the TTS worker a moment to actually synthesize+play.
                # edge-tts streams audio chunks; ~2s is enough for a short
                # answer without blocking too long if the user starts a new
                # dictation immediately after.
                loop.run_until_complete(asyncio.sleep(2.0))
            except Exception as tts_err:
                logger.debug("TTS playback failed (non-fatal): %s", tts_err)
    except Exception as exc:
        logger.exception("Agent execution failed")
        return {
            "success": False,
            "message": f"Agent execution error: {exc}",
            "data": None,
        }
    finally:
        loop.close()

    return {
        "success": result.success,
        "message": result.message,
        "data": result.data,
    }


def is_available() -> bool:
    """Check whether voiceuse is importable (for settings display).

    Returns True if the voice-computer-use-agent package is installed
    and importable, False otherwise. Does not raise.
    """
    try:
        import voiceuse  # noqa: F401
        return True
    except ImportError:
        return False