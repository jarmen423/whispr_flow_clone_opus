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

    Also provides per-session "duck" functionality: mute specific
    applications (Chrome, Spotify, etc.) while leaving others
    (e.g. the TTS playback) unmuted. This is used during agent TTS
    playback so the user hears the agent clearly over background music.

Implementation:
    Windows-only using pycaw (Python bindings for Core Audio APIs).
    Gracefully degrades on non-Windows platforms or if pycaw is unavailable
    (logs a warning, continues without audio control).

Dependencies:
    - pycaw (Windows only; optional)
    - comtypes (transitive dep of pycaw)

Integration:
    Instantiated in LocalFlowAgent.__init__.
    Called from _start_recording() and _stop_recording().
    duck_sessions()/unduck_sessions() called from agent_bridge TTS path.
"""

import sys
from typing import Optional, Dict, List

from .config import log_info, log_warning, log_error, log_debug


class SystemAudioController:
    """Controls system master audio mute state (Windows-only).

    Also supports per-session audio ducking: mute individual application
    audio sessions (Chrome, Spotify, Discord, etc.) while leaving others
    at full volume. This is used when the agent speaks via TTS so the
    user hears the agent clearly over background music.
    """

    # Process names that should NOT be ducked during TTS (the TTS
    # playback engine itself, plus the LocalFlow agent).
    _UNDUCKABLE_PROCESSES = {"python.exe", "pythonw.exe", "py.exe"}

    def __init__(self) -> None:
        self._enabled = False
        self._previous_mute: Optional[int] = None  # 0 or 1
        self._volume_interface = None
        self._ducked_sessions: Dict[str, float] = {}  # pid -> previous volume

        if sys.platform != "win32":
            log_debug("SystemAudioController: Not on Windows, audio mute disabled")
            return

        try:
            from pycaw.pycaw import AudioUtilities

            device = AudioUtilities.GetSpeakers()
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

    # ------------------------------------------------------------------
    # Master mute (used during dictation recording)
    # ------------------------------------------------------------------

    def mute_for_recording(self) -> bool:
        """Mute system audio for the duration of recording."""
        if not self.is_enabled():
            return False

        try:
            self._previous_mute = self._volume_interface.GetMute()
            log_debug(f"SystemAudioController: Previous mute state = {self._previous_mute}")

            self._volume_interface.SetMute(1, None)
            log_info("SystemAudioController: System audio MUTED for dictation")
            return True
        except Exception as e:
            log_error(f"SystemAudioController: Failed to mute: {e}")
            self._previous_mute = None
            return False

    def restore_after_recording(self) -> bool:
        """Restore the previous system audio mute state."""
        if not self.is_enabled():
            return False

        if self._previous_mute is None:
            log_debug("SystemAudioController: No previous state to restore")
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

    # ------------------------------------------------------------------
    # Per-session ducking (used during agent TTS playback)
    # ------------------------------------------------------------------

    def duck_sessions(self) -> bool:
        """Mute all non-TTS application audio sessions.

        Iterates all active audio sessions (Chrome, Spotify, Discord, etc.)
        and saves+mutes each one, EXCEPT python.exe/pythonw.exe (the TTS
        playback process). This lets the agent's TTS be heard clearly
        over background music.

        Returns True if at least one session was ducked.
        """
        if not self.is_enabled():
            return False

        try:
            from pycaw.pycaw import AudioUtilities
            sessions = AudioUtilities.GetAllSessions()
            ducked = 0
            self._ducked_sessions.clear()

            for session in sessions:
                try:
                    vol = session.SimpleAudioVolume
                    if vol is None:
                        continue
                    pid = session.ProcessId
                    proc_name = ""
                    if session.Process:
                        proc_name = session.Process.name() or ""

                    # Skip our own process (TTS plays through pygame in python)
                    if proc_name.lower() in self._UNDUCKABLE_PROCESSES:
                        log_debug(f"Duck: skipping {proc_name} (pid={pid}) — TTS/localflow")
                        continue

                    # Save current volume then mute
                    current_vol = vol.GetMute()
                    self._ducked_sessions[pid] = current_vol
                    vol.SetMute(1, None)
                    ducked += 1
                    log_debug(f"Duck: muted {proc_name} (pid={pid})")
                except Exception:
                    continue

            if ducked > 0:
                log_info(f"SystemAudioController: Ducked {ducked} audio session(s) for TTS")
            else:
                log_debug("SystemAudioController: No sessions to duck")
            return ducked > 0
        except Exception as e:
            log_error(f"SystemAudioController: duck_sessions failed: {e}")
            return False

    def unduck_sessions(self) -> bool:
        """Restore volume for all sessions that were ducked."""
        if not self.is_enabled():
            return False

        if not self._ducked_sessions:
            return False

        try:
            from pycaw.pycaw import AudioUtilities
            sessions = AudioUtilities.GetAllSessions()
            restored = 0

            for session in sessions:
                try:
                    pid = session.ProcessId
                    if pid not in self._ducked_sessions:
                        continue
                    vol = session.SimpleAudioVolume
                    prev_mute = self._ducked_sessions[pid]
                    vol.SetMute(prev_mute, None)
                    restored += 1
                except Exception:
                    continue

            self._ducked_sessions.clear()
            if restored > 0:
                log_info(f"SystemAudioController: Restored {restored} ducked session(s)")
            return restored > 0
        except Exception as e:
            log_error(f"SystemAudioController: unduck_sessions failed: {e}")
            self._ducked_sessions.clear()
            return False

    # ------------------------------------------------------------------
    # Emergency
    # ------------------------------------------------------------------

    def force_unmute(self) -> None:
        """Emergency helper to force-unmute (used in cleanup/error paths)."""
        if not self.is_enabled():
            return
        try:
            self._volume_interface.SetMute(0, None)
            log_warning("SystemAudioController: Forced system audio UNMUTE")
        except Exception as e:
            log_error(f"SystemAudioController: Force unmute failed: {e}")
