"""
System audio control for LocalFlow Desktop Agent.

Purpose:
    Temporarily mutes system (master) audio output when dictation recording
    starts. This prevents background music, videos, or other audio sources
    from interfering with microphone input, ensuring clean speech capture.
    Automatically restores the previous mute state when recording stops.

    Mute is used instead of volume=0 because:
    - It is a distinct state that doesn't alter the user's volume level.
    - Easy to toggle and restore exactly.
    - Works across all playback sources (system-wide).

Implementation:
    Windows-only using pycaw (Python bindings for Core Audio APIs).
    Gracefully degrades on non-Windows platforms or if pycaw is unavailable
    (logs a warning, continues without audio control).

    The controller saves the *previous mute state* (muted or not) and
    restores it on stop — even if the user had manually muted before starting.

Dependencies:
    - pycaw (Windows only; optional)
    - comtypes (transitive dep of pycaw)

Integration:
    Instantiated in LocalFlowAgent.__init__.
    Called from _start_recording() and _stop_recording().
"""

import sys
from typing import Optional

from .config import log_info, log_warning, log_error, log_debug


class SystemAudioController:
    """Controls system master audio mute state (Windows-only)."""

    def __init__(self) -> None:
        self._enabled = False
        self._previous_mute: Optional[int] = None  # 0 or 1
        self._volume_interface = None

        if sys.platform != "win32":
            log_debug("SystemAudioController: Not on Windows, audio mute disabled")
            return

        try:
            from pycaw.pycaw import AudioUtilities

            device = AudioUtilities.GetSpeakers()
            # Modern pycaw (2024+) exposes EndpointVolume directly as the IAudioEndpointVolume pointer
            vol = getattr(device, 'EndpointVolume', None)
            if vol is None:
                raise RuntimeError('EndpointVolume not available on this pycaw/AudioDevice')
            self._volume_interface = vol
            self._enabled = True
            log_info('SystemAudioController: Initialized (Windows + pycaw)')
        except ImportError as e:
            log_warning(
                f'SystemAudioController: pycaw not installed or import failed ({e}). '
                'Install with: uv add pycaw (or pip install pycaw). '
                'Audio auto-mute feature disabled.'
            )
        except Exception as e:
            log_error(f'SystemAudioController: Failed to initialize Core Audio: {e}')
            self._enabled = False

    def is_enabled(self) -> bool:
        """Return True if audio control is available and active."""
        return self._enabled and self._volume_interface is not None

    def mute_for_recording(self) -> bool:
        """
        Mute system audio for the duration of recording.

        Saves the current mute state so it can be restored later.
        Returns True if mute was successfully applied (or already muted).
        """
        if not self.is_enabled():
            return False

        try:
            # Save previous state
            self._previous_mute = self._volume_interface.GetMute()
            log_debug(f"SystemAudioController: Previous mute state = {self._previous_mute}")

            # Set mute ON (1)
            self._volume_interface.SetMute(1, None)
            log_info("SystemAudioController: System audio MUTED for dictation")
            return True
        except Exception as e:
            log_error(f"SystemAudioController: Failed to mute: {e}")
            self._previous_mute = None
            return False

    def restore_after_recording(self) -> bool:
        """
        Restore the previous system audio mute state.

        Safe to call even if mute_for_recording was never called or failed.
        Returns True if restore succeeded.
        """
        if not self.is_enabled():
            return False

        if self._previous_mute is None:
            log_debug("SystemAudioController: No previous state to restore (was not muted by us)")
            return False

        try:
            restore_value = self._previous_mute
            self._volume_interface.SetMute(restore_value, None)
            log_info(f"SystemAudioController: System audio restored (mute={restore_value})")
            self._previous_mute = None
            return True
        except Exception as e:
            log_error(f"SystemAudioController: Failed to restore audio state: {e}")
            self._previous_mute = None
            return False

    def force_unmute(self) -> None:
        """Emergency helper to force-unmute (used in cleanup/error paths)."""
        if not self.is_enabled():
            return
        try:
            self._volume_interface.SetMute(0, None)
            log_warning("SystemAudioController: Forced system audio UNMUTE")
        except Exception as e:
            log_error(f"SystemAudioController: Force unmute failed: {e}")
