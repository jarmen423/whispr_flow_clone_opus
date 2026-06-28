#!/usr/bin/env python3
"""LocalFlow Desktop Agent - System-wide dictation client with hosted API.

This module provides the LocalFlow Desktop Agent, a system-wide dictation tool that
captures audio via global hotkeys and sends it to the hosted LocalFlow API for
real-time transcription and AI-powered refinement. It serves as the client-side
component of the LocalFlow voice-to-text infrastructure.

Purpose & Reasoning:
    The agent was created to provide seamless, hands-free dictation capabilities
    across all applications on the desktop. Unlike traditional dictation software
    that requires switching contexts, this agent uses global hotkeys (via pynput)
    to capture audio at any time, then sends it via HTTP POST to the hosted
    LocalFlow API (dictate.agentmemorylabs.com) for transcription and LLM-based
    refinement. Users bring their own Groq API key (BYOK) for cloud transcription.

Dependencies:
    External Services:
        - LocalFlow hosted API (default: https://dictate.agentmemorylabs.com)
        - Groq API (user-provided key for transcription)

    Internal Modules:
        - config: Configuration, logging, env loading
        - recording: AudioRecorder, PasteHandler
        - api: HTTP communication and process_audio_bytes pipeline
        - recovery: Failed-recording lifecycle and retry logic
        - hotkeys: Global hotkey listener setup

    Python Packages:
        - pynput: Global hotkey listening across all applications
        - sounddevice: Cross-platform audio capture from default input device
        - scipy: WAV file encoding for audio transmission
        - requests: HTTP client for API communication
        - pyperclip: Clipboard operations for text insertion
        - pyautogui: Cross-platform GUI automation for paste simulation
        - numpy: Audio buffer manipulation and WAV data processing
        - python-dotenv: Environment variable loading from .env files

Role in Codebase:
    This is the primary client-side entry point for desktop users. It is
    instantiated by users running the LocalFlow desktop agent and communicates
    with the hosted LocalFlow API to process voice dictation. The agent handles:
    hotkey detection, audio capture, API communication, and automatic text
    insertion at the cursor position.

Usage:
    localflow-agent

Configuration:
    Set environment variables in .env file or modify the CONFIG section.
    Key settings include LOCALFLOW_API_URL, LOCALFLOW_HOTKEY, and GROQ_API_KEY.
    On first run, the agent will prompt for a Groq API key and save it to
    ~/.localflow/config.json.

Example:
    $ localflow-agent
    [2024-01-15 10:30:00] [INFO] LocalFlow Desktop Agent
    [2024-01-15 10:30:00] [INFO] Listening for hotkey: alt+l
"""

import os
import sys
import argparse
import json
import webbrowser
import time
import threading
from pathlib import Path
from typing import Optional

import pyperclip

# Internal submodule imports
from .config import (
    CONFIG,
    CLIENT_VERSION,
    _ensure_api_key,
    _load_config_file,
    _bool_setting,
    _float_setting,
    _string_setting,
    log,
    log_info,
    log_error,
    log_debug,
    log_warning,
)
from .recording import AudioRecorder, PasteHandler
from .recording_overlay import RecordingOverlay
from .api import process_audio_bytes, _format_text
from .hotkeys import setup_hotkey_listener
from .recovery import (
    _save_failed_recording_candidate,
    _retain_failed_recording,
    _discard_failed_recording_candidate,
    _retry_failed_recording,
    _retry_latest_failed,
    _enumerate_failed_recordings,
    _cleanup_failed_recordings,
)
from .audio_control import SystemAudioController
from .setup_wizard import _run_setup_wizard
# Presentation of the Recovery Console and the age-formatting helpers moved to
# recovery_console.py; successful-transcript history lives in history.py.
from .recovery_console import generate_recovery_console, _format_age_short
from .history import (
    _save_successful_history,
    _enumerate_history,
    _cleanup_history,
    _replay_history,
)


# ============================================
# LOCALFLOW AGENT
# ============================================


class LocalFlowAgent:
    """Main orchestrator coordinating all agent components.

    The LocalFlowAgent is the central controller that manages the entire
    dictation workflow. It coordinates between the AudioRecorder for
    capture, PasteHandler for text insertion, RecordingOverlay for
    visual feedback, and the hosted API for transcription and refinement.

    This class implements the core state machine for recording sessions,
    sends audio via HTTP POST to the hosted API, and processes responses
    to trigger text insertion.

    Key Technologies/APIs:
        - requests.post: HTTP communication with the hosted API
        - pynput.keyboard: Global hotkey registration across all apps
        - threading.Thread: Background overlay threads
        - time.time: Millisecond timestamps for server synchronization

    Attributes:
        recorder: AudioRecorder instance for audio capture.
        paste_handler: PasteHandler instance for text insertion.
        overlay: RecordingOverlay instance for visual feedback.
        api_key: User's Groq API key for BYOK cloud transcription.
        mode: Current processing mode (developer, concise, etc.).
        processing_mode: Where processing occurs (cloud, local, etc.).
        hotkey: Current global hotkey configuration string.
        format_hotkey: LLM formatting hotkey configuration.
        running: Boolean indicating if agent main loop is active.
        hotkey_pressed: Boolean tracking if hotkey is currently held.
        format_mode_active: Whether format hotkey was used.
        pasting_in_progress: Flag to prevent keyboard interference.

    Example:
        >>> agent = LocalFlowAgent()
        >>> agent.run()  # Blocks until interrupted
    """

    def __init__(self) -> None:
        """Initialize the LocalFlowAgent and all subcomponents.

        Creates instances of all required components (AudioRecorder,
        PasteHandler, RecordingOverlay). The agent communicates with
        the hosted API via HTTP POST instead of WebSocket.

        Returns:
            None
        """
        self.recorder = AudioRecorder()
        self.paste_handler = PasteHandler(self)
        self.overlay = RecordingOverlay()
        self.api_key = CONFIG.api_key
        self.mode = CONFIG.mode
        self.processing_mode = CONFIG.processing_mode
        # Hotkeys are resolved with env > config.json > CONFIG default. Previously
        # these were read from env only, so config.json could never override them.
        # ``_string_setting`` makes ~/.localflow/config.json authoritative while
        # keeping the existing env-var override behavior unchanged.
        config_data = _load_config_file()
        self.hotkey = _string_setting(config_data, "hotkey", "LOCALFLOW_HOTKEY", CONFIG.hotkey)
        self.format_hotkey = _string_setting(config_data, "format_hotkey", "LOCALFLOW_FORMAT_HOTKEY", CONFIG.format_hotkey)
        self.translate_hotkey = _string_setting(
            config_data, "translate_hotkey", "LOCALFLOW_TRANSLATE_HOTKEY", CONFIG.translate_hotkey
        )
        self.cleanup_hotkey = _string_setting(
            config_data, "cleanup_hotkey", "LOCALFLOW_CLEANUP_HOTKEY", CONFIG.cleanup_hotkey
        )
        self.selection_format_hotkey = _string_setting(
            config_data, "selection_format_hotkey", "LOCALFLOW_SELECTION_FORMAT_HOTKEY", CONFIG.selection_format_hotkey
        )
        self.agent_hotkey = _string_setting(config_data, "agent_hotkey", "LOCALFLOW_AGENT_HOTKEY", CONFIG.agent_hotkey)
        # Toggle dictation hotkeys (press once to start, press again to stop).
        self.toggle_hotkey = _string_setting(
            config_data, "toggle_hotkey", "LOCALFLOW_TOGGLE_HOTKEY", CONFIG.toggle_hotkey
        )
        self.toggle_hotkey_secondary = _string_setting(
            config_data, "toggle_hotkey_secondary", "LOCALFLOW_TOGGLE_HOTKEY_2", CONFIG.toggle_hotkey_secondary
        )
        self.selection_format_default_target = CONFIG.selection_format_default_target
        self.selection_formatter_enabled = CONFIG.selection_formatter_enabled
        self.save_failed_recordings = _bool_setting(
            config_data,
            "save_failed_recordings",
            "LOCALFLOW_SAVE_FAILED_RECORDINGS",
            CONFIG.save_failed_recordings,
        )
        self.failed_recordings_dir = Path(
            _string_setting(
                config_data,
                "failed_recordings_dir",
                "LOCALFLOW_FAILED_RECORDINGS_DIR",
                CONFIG.failed_recordings_dir,
            )
        ).expanduser()
        self.failed_recordings_retention_hours = max(
            0.0,
            _float_setting(
                config_data,
                "failed_recordings_retention_hours",
                "LOCALFLOW_FAILED_RECORDINGS_RETENTION_HOURS",
                CONFIG.failed_recordings_retention_hours,
            ),
        )
        # Successful-transcription history keeps the returned TEXT (never the
        # audio) so a non-API loss — released the hotkey early, paste missed
        # the window, keyboard didn't register — can be recovered from the
        # Recovery Console by copying saved text without a new API call.
        self.save_history = _bool_setting(
            config_data,
            "save_history",
            "LOCALFLOW_SAVE_HISTORY",
            CONFIG.save_history,
        )
        self.history_dir = Path(
            _string_setting(
                config_data,
                "history_dir",
                "LOCALFLOW_HISTORY_DIR",
                CONFIG.history_dir,
            )
        ).expanduser()
        self.history_retention_hours = max(
            0.0,
            _float_setting(
                config_data,
                "history_retention_hours",
                "LOCALFLOW_HISTORY_RETENTION_HOURS",
                CONFIG.history_retention_hours,
            ),
        )
        self.running = True
        self.hotkey_pressed = False
        self.format_mode_active = False
        self.translate_mode_active = False
        self.agent_mode_active = False
        self.pasting_in_progress = False
        # Which trigger started the current recording. "hold" recordings stop on
        # hotkey release; "toggle" recordings only stop on a second toggle press.
        # None when idle. Read by hotkeys.on_release to gate the stop path.
        self.recording_source: Optional[str] = None
        # Debounce timestamp for the toggle callback; avoids an instant
        # start->stop if pynput double-fires the toggle combo on one press.
        self.last_toggle_time: float = 0.0
        self.ghost_mode = _bool_setting(
            config_data,
            "ghost_mode",
            "LOCALFLOW_GHOST_MODE",
            CONFIG.ghost_mode,
        )
        self.audio_controller = SystemAudioController()

    # ------------------------------------------------------------------
    # Recording lifecycle (called by hotkey callbacks)
    # ------------------------------------------------------------------

    def _start_recording(self, format_mode: bool = False, translate_mode: bool = False, agent_mode: bool = False, source: str = "hold") -> None:
        """Initiate audio recording session.

        Starts the AudioRecorder and displays the visual overlay.
        Sets the mode flags (format/translate) which determine how
        the transcription is processed.

        Args:
            format_mode: If True, uses LLM formatting/outline mode.
            translate_mode: If True, uses translation mode.
            agent_mode: If True, uses voice agent Q&A mode.
            source: Which trigger started this recording. "hold" (default)
                recordings are stopped by the hotkey release listener;
                "toggle" recordings are only stopped by a second toggle
                press. Set on a successful start only and reset in
                ``_stop_recording``.

        Returns:
            None
        """
        if self.recorder.start():
            self.overlay.show()
            # Mute system audio to prevent background sources from interfering with mic
            self.audio_controller.mute_for_recording()
            # Record the trigger so on_release only auto-stops hold sessions.
            self.recording_source = source

            if agent_mode:
                log_info("🤖 Agent mode recording started")
            elif translate_mode:
                log_info("🌐 Translation mode recording started")
            elif format_mode:
                log_info("📝 Format mode recording started")
            else:
                log_info("Recording started")

            self.format_mode_active = format_mode
            self.translate_mode_active = translate_mode
            self.agent_mode_active = agent_mode

            if format_mode:
                log_info("Format mode activated (Alt+M)")
            if translate_mode:
                log_info("Translation mode activated (Alt+T)")

    def _stop_recording(self) -> None:
        """Stop recording and process audio via the hosted API.

        Halts the audio recorder, hides the visual overlay, and sends the
        captured audio as multipart form data to the hosted API
        """
        # Clear the trigger up-front (before recorder.stop() frees the device).
        # This runs on the pynput Listener thread while a new hold recording can
        # be started on the GlobalHotKeys thread during the multi-second API
        # call below. A tail reset here would clobber that new session's
        # recording_source, leaving it unstoppable via the on_release gate;
        # clearing first means any later session sets its own source cleanly.
        self.recording_source = None

        self.overlay.hide()
        # Restore previous system audio state (unmute if we muted it)
        self.audio_controller.restore_after_recording()

        audio_bytes = self.recorder.stop()

        if self.agent_mode_active:
            effective_mode = "agent"
        elif self.format_mode_active:
            effective_mode = "outline"
        else:
            effective_mode = self.mode

        if not audio_bytes:
            log_warning("No audio captured")
            self.format_mode_active = False
            self.translate_mode_active = False
            self.agent_mode_active = False
            return

        failed_recording_path = _save_failed_recording_candidate(
            audio_bytes,
            effective_mode,
            self.processing_mode,
            self.translate_mode_active,
            self.save_failed_recordings,
            self.failed_recordings_dir,
            self.failed_recordings_retention_hours,
        )

        log_info(f"Audio captured ({'Translate' if self.translate_mode_active else 'Normal'}), sending to API...")

        result = process_audio_bytes(
            audio_bytes,
            effective_mode,
            self.translate_mode_active,
            self.api_key,
            self.processing_mode,
            run_agent_query=True,
            ghost=self.ghost_mode,
        )

        if not result["success"]:
            error = result.get("error") or "Transcription failed"
            log_error(f"Transcription failed: {error}")
            _retain_failed_recording(
                failed_recording_path,
                effective_mode,
                self.processing_mode,
                self.translate_mode_active,
                self.failed_recordings_retention_hours,
                error,
            )
            self.overlay.show_status("Saved for recovery", bg_color="#24486b")
            if failed_recording_path:
                log_info(f"Recording saved for recovery: {failed_recording_path}")
                log_info("Recover with: localflow-agent --recover")
            self.format_mode_active = False
            self.translate_mode_active = False
            self.agent_mode_active = False
            return

        _discard_failed_recording_candidate(failed_recording_path)

        if result.get("agent_failed"):
            self.overlay.show_status("Agent failed", bg_color="#7a2e2e")
        elif result.get("refine_failed"):
            log_warning("Refinement failed, using raw text")

        final_text = result["text"]
        if final_text:
            self.paste_handler.paste_text(final_text)
            # Retain the returned text (NOT the audio) so a non-API loss can be
            # recovered later from the Recovery Console by copying saved text
            # without a new API call. The failed-recovery WAV candidate was
            # already discarded above; this history entry is text-only.
            _save_successful_history(
                final_text,
                effective_mode,
                self.processing_mode,
                self.translate_mode_active,
                self.save_history,
                self.history_dir,
                self.history_retention_hours,
            )
        else:
            log_warning("Final text is empty, skipping paste")

        self.format_mode_active = False
        self.translate_mode_active = False
        self.agent_mode_active = False

    # ------------------------------------------------------------------
    # Translation toggle
    # ------------------------------------------------------------------

    def toggle_translation(self) -> None:
        """Toggle translation mode on/off with visual feedback.

        Switches the translate_mode flag which determines whether audio
        should be translated to English instead of just transcribed.
        Shows a brief visual notification via the overlay.

        Key Technologies/APIs:
            - RecordingOverlay: Visual feedback for mode toggle
            - threading.Thread: Background timer for auto-hide

        Returns:
            None
        """
        self.translate_mode_active = not self.translate_mode_active
        status = "ON 🌐" if self.translate_mode_active else "OFF"
        log_info(f"Translation mode: {status}")

        try:
            self.overlay.show()
            def hide_after_delay():
                time.sleep(1.5)
                if not self.recorder.is_recording():
                    self.overlay.hide()
            threading.Thread(target=hide_after_delay, daemon=True).start()
        except Exception as e:
            log_debug(f"Overlay notification failed: {e}")

    # ------------------------------------------------------------------
    # Selected-text formatting
    # ------------------------------------------------------------------

    def format_selected_text(self, format_target: Optional[str] = None) -> bool:
        """Format the current text selection and replace it at the cursor."""
        target = format_target or self.selection_format_default_target
        action_label = "Cleaning up selection" if target == "cleanup" else f"Formatting {target.upper()}..."
        success_label = "Cleaned up" if target == "cleanup" else "Formatted"
        if not self.selection_formatter_enabled:
            log_warning("Selected-text formatter is disabled")
            self.overlay.show_status("Formatter disabled", bg_color="#7a2e2e")
            return False

        try:
            selected_text = self.paste_handler.copy_selection().strip()
            if not selected_text:
                log_warning("No selected text found to format")
                self.overlay.show_status("No selection", bg_color="#7a5a20")
                return False

            self.overlay.show_status(action_label, bg_color="#24486b", duration=0)
            formatted_text = _format_text(selected_text, target, self.processing_mode)
            self.overlay.hide()
            pasted = self.paste_handler.paste_text(formatted_text)
            self.overlay.show_status(success_label, bg_color="#1f6a3c" if pasted else "#7a2e2e")
            return pasted
        except Exception as e:
            log_error(f"Failed to format selected text: {e}")
            self.overlay.show_status("Formatting failed", bg_color="#7a2e2e")
            return False

    def choose_format_target(self) -> Optional[str]:
        """Open a small chooser window for selected-text formatting."""
        try:
            import tkinter as tk
        except ImportError:
            log_error("Tkinter is not available for the format chooser")
            return None

        options = ["markdown", "cleanup", "json", "jsonl", "csv"]
        result = {"target": None}

        root = tk.Tk()
        root.title("Whispr Flow Format")
        root.attributes("-topmost", True)
        root.resizable(False, False)

        frame = tk.Frame(root, padx=16, pady=16)
        frame.pack()

        tk.Label(frame, text="Format selected text as:", anchor="w").pack(fill="x", pady=(0, 8))

        for option in options:
            tk.Button(
                frame,
                text=option.upper(),
                width=20,
                command=lambda value=option: (result.__setitem__("target", value), root.destroy()),
            ).pack(fill="x", pady=2)

        tk.Button(frame, text="Cancel", width=20, command=root.destroy).pack(fill="x", pady=(8, 0))
        root.mainloop()
        return result["target"]

    # ------------------------------------------------------------------
    # Hotkey listener setup (delegates to hotkeys module)
    # ------------------------------------------------------------------

    def _setup_hotkey_listener(self):
        """Configure global hotkey listeners for recording triggers.

        Delegates to the ``hotkeys.setup_hotkey_listener`` function,
        passing this agent instance so callbacks can access its state
        and methods without circular imports.
        """
        return setup_hotkey_listener(self)

    # ------------------------------------------------------------------
    # Main event loop
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Execute the main agent event loop.

        The primary entry point for agent operation. Displays startup
        information, ensures API key is configured, and sets up global
        hotkey listeners. Then enters the main loop waiting for keyboard
        interrupts or shutdown signals.

        This method blocks until the agent is stopped via Ctrl+C or
        other interruption mechanism.

        Returns:
            None: This method blocks indefinitely during operation.

        Raises:
            No exceptions are raised; KeyboardInterrupt is caught
            for graceful shutdown.
        """
        if not self.api_key:
            self.api_key = _ensure_api_key()

        _cleanup_failed_recordings(self.failed_recordings_dir, self.failed_recordings_retention_hours)
        _cleanup_history(self.history_dir, self.history_retention_hours)

        log_info("=" * 60)
        log_info("LocalFlow Desktop Agent")
        log_info("=" * 60)
        log_info(f"API: {CONFIG.api_url}")
        log_info(f"Hotkey (raw): {self.hotkey}")
        log_info(f"Hotkey (format): {self.format_hotkey}")
        log_info(f"Hotkey (translate): {self.translate_hotkey}")
        log_info(f"Hotkey (cleanup): {self.cleanup_hotkey}")
        log_info(f"Hotkey (selection format): {self.selection_format_hotkey}")
        log_info(f"Hotkey (toggle primary): {self.toggle_hotkey}")
        log_info(f"Hotkey (toggle secondary): {self.toggle_hotkey_secondary}")
        log_info(f"Mode: {self.mode}")
        log_info(f"Processing: {self.processing_mode}")
        if self.save_failed_recordings:
            log_info(
                "Failed recording recovery: "
                f"{self.failed_recordings_dir} "
                f"(retention: {self.failed_recordings_retention_hours:g}h)"
            )
        else:
            log_info("Failed recording recovery: disabled")
        if self.save_history:
            log_info(
                "Transcript history: "
                f"{self.history_dir} "
                f"(retention: {self.history_retention_hours:g}h)"
            )
        else:
            log_info("Transcript history: disabled")
        log_info("=" * 60)

        listener = self._setup_hotkey_listener()
        log_info(f"Listening for hotkey: {self.hotkey}")
        log_info(f"Translation toggle: {self.translate_hotkey} (currently {'ON' if self.translate_mode_active else 'OFF'})")
        log_info("Press the hotkey to start recording, release to stop and transcribe.")
        log_info("Press Ctrl+C to exit.")

        try:
            while self.running:
                time.sleep(0.1)
        except KeyboardInterrupt:
            log_info("\nShutting down...")
        finally:
            self.running = False
            listener.stop()
            log_info("Agent stopped")


# ============================================
# CLI HELPERS
# ============================================


def check_dependencies() -> None:
    """Verify all required Python packages are installed.

    Performs import checks for all runtime dependencies and reports
    any missing packages with installation instructions. Exits the
    program with status 1 if dependencies are missing.

    Key Technologies/APIs:
        - importlib-style dynamic imports via try/except
        - sys.exit: Program termination with error code

    Returns:
        None: Exits with code 1 if dependencies are missing.

    Raises:
        SystemExit: If any required dependency is not installed.

    Example:
        >>> check_dependencies()
        # Exits silently if all dependencies present
        # Or prints missing packages and exits with code 1
    """
    missing = []

    try:
        import numpy
    except ImportError:
        missing.append("numpy")

    try:
        import sounddevice
    except ImportError:
        missing.append("sounddevice")

    try:
        import scipy
    except ImportError:
        missing.append("scipy")

    try:
        import pyperclip
    except ImportError:
        missing.append("pyperclip")

    try:
        import pyautogui
    except ImportError:
        missing.append("pyautogui")

    try:
        import pynput
    except ImportError:
        missing.append("pynput")

    try:
        import requests
    except ImportError:
        missing.append("requests")

    if missing:
        print("Missing dependencies:")
        for dep in missing:
            print(f"  - {dep}")
        print("\nInstall with:")
        print(f"  pip install {' '.join(missing)}")
        sys.exit(1)


def _open_in_browser(html_path: Path) -> None:
    """Open an HTML file in the user's default browser.

    On Windows, ``os.startfile`` is used because it is synchronous (the shell
    launches the registered handler before returning) and works reliably from a
    transient child process — ``webbrowser.open`` spawns a detached helper that
    can be lost if the parent exits quickly. On macOS/Linux we fall back to the
    standard ``webbrowser`` module.
    """
    path_str = str(html_path)
    try:
        if sys.platform == "win32":
            os.startfile(path_str)  # type: ignore[attr-defined]
        else:
            webbrowser.open(f"file:///{path_str.replace(os.sep, '/')}")
    except Exception as e:
        log_warning(f"Could not open recovery console in browser: {e}")
        print(f"Open manually: {path_str}")


def _run_list_failed_recordings(agent: LocalFlowAgent) -> None:
    """Print retained failed recordings newest-first to stdout."""
    entries = _enumerate_failed_recordings(agent.failed_recordings_dir)
    if not entries:
        print("No retained failed recordings.")
        print(f"Directory: {agent.failed_recordings_dir}")
        return

    print(f"Retained failed recordings ({len(entries)}):")
    print(f"Directory: {agent.failed_recordings_dir}")
    print("-" * 60)
    for e in entries:
        status = "RECOVERED" if e["recovered"] else e["status"].upper()
        translate_tag = " [translated]" if e["translate"] else ""
        print(f"  {status:10}  {_format_age_short(e['age_hours']):>6} ago  [{e['mode']}]{translate_tag}")
        print(f"    {e['path']}")
        if e["error"]:
            err = e["error"]
            if len(err) > 120:
                err = err[:117] + "..."
            print(f"    error: {err}")
        if not e["recovered"]:
            print(f"    retry: localflow-agent --retry-failed-recording \"{e['path']}\"")
    print("-" * 60)


def _print_retry_result(result: dict) -> None:
    """Pretty-print the outcome of a failed-recording retry."""
    if result.get("success"):
        print("Recovery succeeded.")
        print(f"  Source:    {result.get('wav_path')}")
        print(f"  Transcript saved to: {result.get('transcript_path')}")
        if result.get("agent_query_replayed"):
            print("  Agent web-search query was replayed.")
        else:
            print("  Recovered text copied to clipboard. (Agent-mode recordings transcribe only by default.)")
        text = result.get("text", "")
        preview = text if len(text) <= 200 else text[:197] + "..."
        print(f"  Preview:   {preview!r}")
    else:
        err = result.get("error") or "Unknown error"
        print(f"Recovery failed: {err}")
        if result.get("wav_path"):
            print(f"  Source: {result.get('wav_path')}")


def _run_list_history(agent: LocalFlowAgent) -> None:
    """Print saved successful transcripts newest-first to stdout.

    Successful entries never need an API call to recover: the text already
    exists on disk. This listing mirrors ``--list-failed-recordings`` so the
    user can find the right ``--replay-history`` target.
    """
    entries = _enumerate_history(agent.history_dir)
    if not entries:
        print("No saved successful transcripts.")
        print(f"Directory: {agent.history_dir}")
        return

    print(f"Saved successful transcripts ({len(entries)}):")
    print(f"Directory: {agent.history_dir}")
    print("-" * 60)
    for e in entries:
        translate_tag = " [translated]" if e["translate"] else ""
        print(f"  {_format_age_short(e['age_hours']):>6} ago  [{e['mode']}]{translate_tag}  {e.get('chars', 0)} chars")
        print(f"    {e['txt_path']}")
        preview = e.get("text", "")
        preview = preview if len(preview) <= 120 else preview[:117] + "..."
        preview_flat = " ".join(preview.split())
        print(f"    text: {preview_flat!r}")
        print(f"    copy: localflow-agent --replay-history \"{e['txt_path']}\"")
    print("-" * 60)


def _print_replay_result(result: dict) -> None:
    """Pretty-print the outcome of a ``--replay-history`` copy/paste.

    Emphasises that no API call was made: the saved text was read from disk
    and delivered to the clipboard (or pasted).
    """
    if result.get("success"):
        action = "Pasted" if result.get("pasted") else "Copied to clipboard"
        print(f"Saved transcript {action.lower()} (no API call).")
        print(f"  Source: {result.get('txt_path')}")
        text = result.get("text", "")
        preview = text if len(text) <= 200 else text[:197] + "..."
        print(f"  Preview: {preview!r}")
    else:
        err = result.get("error") or "Unknown error"
        print(f"Replay failed: {err}")
        if result.get("txt_path"):
            print(f"  Source: {result.get('txt_path')}")


# ============================================
# MAIN ENTRY POINTS (used by pyproject.toml)
# ============================================


def _stop_background_agent() -> None:
    """Kill any running background LocalFlow agent process."""
    import subprocess
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ["taskkill", "/IM", "localflow-agent.exe", "/F"],
                capture_output=True, text=True,
            )
        else:
            result = subprocess.run(
                ["pkill", "-f", "localflow-agent"],
                capture_output=True, text=True,
            )
        if result.returncode == 0:
            print("LocalFlow agent stopped.")
        else:
            print("No running LocalFlow agent found.")
    except FileNotFoundError:
        print("No running LocalFlow agent found.")


def _pretty_hotkey(hk: str) -> str:
    """Format a hotkey string for display: 'alt+l' -> 'Alt+L'."""
    return "+".join(p.strip().capitalize() for p in hk.split("+"))


def _print_diagnostics() -> None:
    """Print install + environment diagnostics and exit. Used by --diag.

    Helps users verify the agent is wired up correctly before they rely on
    it. Reports Python version, platform, LocalFlow install location,
    config file, log file, dependency importability, and (on Windows) the
    default audio input device.
    """
    import platform
    import shutil
    import subprocess

    print("LocalFlow agent diagnostics")
    print("=" * 50)
    print(f"  Python:        {sys.version.split()[0]} ({sys.executable})")
    print(f"  Platform:      {platform.platform()}")
    print(f"  localflow-agent: {shutil.which('localflow-agent') or 'NOT FOUND in PATH'}")
    print(f"  Config file:   {os.path.expanduser('~/.localflow/config.json')}")
    print(f"  Log file:      {os.path.expanduser('~/.localflow/agent.log')}")
    print(f"  Failed dir:    {os.path.expanduser('~/.localflow/failed-recordings')}")
    print(f"  History dir:   {os.path.expanduser('~/.localflow/history')}")
    print()

    # Dependency imports
    print("Dependencies:")
    for mod in ("pynput", "sounddevice", "numpy", "scipy", "requests",
                "pyperclip", "pyautogui", "pycaw", "comtypes", "dotenv"):
        try:
            __import__(mod)
            print(f"  [OK]    {mod}")
        except ImportError as e:
            print(f"  [MISS]  {mod}: {e}")
    print()

    # Optional: voiceuse / agent_bridge
    try:
        import voiceuse  # noqa: F401
        print("  [OK]    voiceuse (agent mode available)")
    except ImportError:
        print("  [skip]  voiceuse (agent mode disabled)")
    print()

    # Audio device
    try:
        import sounddevice as sd
        print("Audio input devices:")
        for idx, dev in enumerate(sd.query_devices()):
            if dev.get("max_input_channels", 0) > 0:
                marker = "  <-- default" if idx == sd.default.device[0] else ""
                print(f"  [{idx}] {dev['name']} (inputs={dev['max_input_channels']}){marker}")
    except Exception as e:
        print(f"  Could not query audio devices: {e}")
    print()

    # Background process check (Windows)
    if sys.platform == "win32":
        try:
            result = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq localflow-agent.exe"],
                capture_output=True, text=True,
            )
            if "localflow-agent.exe" in result.stdout:
                print("Background agent: RUNNING")
                for line in result.stdout.splitlines():
                    if "localflow-agent.exe" in line:
                        print(f"  {line.strip()}")
            else:
                print("Background agent: NOT RUNNING")
        except Exception as e:
            print(f"  Could not check background process: {e}")
    print()
    print("If hotkeys aren't firing, see ~/.localflow/agent.log for the")
    print("most recent error. Also try `localflow-agent --foreground` to")
    print("see the live event loop output.")
    print()


def _print_background_banner(agent: "LocalFlowAgent") -> None:
    """Print hotkey summary before detaching to background."""
    config_path = os.path.expanduser("~/.localflow/config.json")

    # Check if voice agent mode is available
    try:
        from localflow_agent.agent_bridge import is_available as _agent_available
        agent_installed = _agent_available()
    except Exception:
        agent_installed = False

    print()
    print("  LocalFlow agent is running in the background.")
    print()
    print("  Hold a hotkey, speak, release to paste:")
    print()
    print(f"    {_pretty_hotkey(agent.hotkey):<16} Raw dictation (fastest)")

    hotkey_info = [
        ("format_hotkey", "Format mode (outlines, lists)"),
        ("translate_hotkey", "Translation toggle"),
        ("toggle_hotkey", "Toggle dictation mode"),
    ]
    for attr, label in hotkey_info:
        hk = getattr(agent, attr, None)
        if hk:
            print(f"    {_pretty_hotkey(hk):<16} {label}")

    # Agent mode hotkey
    agent_hk = getattr(agent, "agent_hotkey", None)
    if agent_hk:
        if agent_installed:
            print(f"    {_pretty_hotkey(agent_hk):<16} Voice agent (control your computer)")
        else:
            print(f"    {_pretty_hotkey(agent_hk):<16} Voice agent (not installed)")

    print()
    print(f"  To change hotkeys, edit:")
    print(f"    {config_path}")
    print()

    if not agent_installed:
        print("  Voice agent mode available! Control your computer by voice.")
        print("  Install: pip install localflow-agent[agent]")
        print()

    print("  To stop:        localflow-agent --stop")
    print("  For debugging:  localflow-agent --foreground")
    print()


def _launch_in_background() -> None:
    """Re-launch the agent with --foreground as a hidden background process.

    On Windows, uses ``Start-Process -WindowStyle Hidden`` via PowerShell,
    matching the proven approach from whispr-flow.ps1. No console window
    is created, and closing the parent terminal does not kill the agent.

    On macOS/Linux, uses ``nohup ... &`` via shell, matching whispr-flow.sh.
    The agent survives the parent shell via SIGHUP ignore + background fork.
    """
    import subprocess
    import shlex

    log_dir = os.path.expanduser("~/.localflow")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "agent.log")

    # Build the child command. Append --foreground so the child runs the
    # event loop instead of recursing into background detach.
    # On Windows, use the bare command name "localflow-agent" (not the full
    # exe path) so PowerShell PATH resolution finds it, same as whispr-flow.ps1.
    # The full path with backslashes breaks nested PowerShell quoting.
    extra_args = [a for a in sys.argv[1:] if a not in ("--stop",)]

    if sys.platform == "win32":
        # Match whispr-flow.ps1: a single Start-Process that launches the
        # python agent in a hidden window. Hidden is fine here because
        # the *python* process still runs in a real interactive desktop
        # session (it's only the parent powershell that's hidden). The
        # previous double-wrap with inner/outer powershell + log redirect
        # made this fragile and caused silent failures.
        child_cmd_str = "localflow-agent --foreground"
        if extra_args:
            child_cmd_str += " " + " ".join(extra_args)
        ps_script = (
            f"Start-Process powershell "
            f"-ArgumentList @('-NoProfile','-Command','{child_cmd_str}') "
            f"-WindowStyle Hidden"
        )
        subprocess.Popen(
            ["powershell", "-NoProfile", "-Command", ps_script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )
    else:
        # macOS / Linux: nohup + background, same as whispr-flow.sh
        child_cmd_parts = ["localflow-agent"] + extra_args + ["--foreground"]
        full_cmd = "nohup " + " ".join(shlex.quote(p) for p in child_cmd_parts) \
            + f" >> '{log_path}' 2>&1 &"
        subprocess.Popen(
            full_cmd,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
        )



def main() -> None:
    """Application entry point.

    Performs dependency verification and launches the LocalFlowAgent.
    This is the standard entry point when running the agent.
    Referenced by ``pyproject.toml`` console_scripts as
    ``localflow-agent = "localflow_agent:main"``.

    Key Technologies/APIs:
        - check_dependencies: Pre-flight dependency verification
        - LocalFlowAgent: Main application controller
        - LocalFlowAgent.run(): Blocking event loop execution

    Returns:
        None: This function blocks during agent operation.

    Example:
        $ localflow-agent
        # Agent starts and runs until interrupted
    """
    check_dependencies()

    parser = argparse.ArgumentParser(description="LocalFlow desktop agent")
    parser.add_argument(
        "--format-selection",
        action="store_true",
        help="Format the currently selected text instead of running the agent loop",
    )
    parser.add_argument(
        "--choose-format",
        action="store_true",
        help="Show a chooser window for the selected-text formatter",
    )
    parser.add_argument(
        "--format-target",
        choices=["markdown", "json", "jsonl", "csv"],
        help="Explicit output target for --format-selection",
    )
    parser.add_argument(
        "--recover",
        action="store_true",
        help="Generate and open the local Recovery Console (recovery.html): Failed tab (retry needs an API call) and Successful tab (copy saved text, no API call)",
    )
    parser.add_argument(
        "--list-failed-recordings",
        action="store_true",
        help="Print retained failed recordings newest-first and exit",
    )
    parser.add_argument(
        "--list-history",
        action="store_true",
        help="Print saved successful transcripts newest-first and exit",
    )
    parser.add_argument(
        "--retry-latest-failed",
        action="store_true",
        help="Retry transcription of the newest unrecovered failed recording",
    )
    parser.add_argument(
        "--retry-failed-recording",
        metavar="PATH",
        help="Retry transcription of a specific failed recording WAV path",
    )
    parser.add_argument(
        "--replay-history",
        metavar="PATH",
        help="Copy (or paste, with --paste) a saved successful transcript to the cursor WITHOUT an API call",
    )
    parser.add_argument(
        "--paste",
        action="store_true",
        help="With a retry, paste the recovered text at the cursor instead of copying to the clipboard",
    )
    parser.add_argument(
        "--retry-agent-query",
        action="store_true",
        help="When retrying an agent-mode recording, also replay the web-search voice agent query",
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="With --recover, generate the console but do not open it in a browser",
    )
    parser.add_argument(
        "--foreground",
        action="store_true",
        help="Run in the foreground (blocks terminal, shows logs). Default is background.",
    )
    parser.add_argument(
        "--ghost",
        action="store_true",
        help="Ghost mode: suppress TTS for agent responses (Alt+A). The agent's text response is still pasted at the cursor and saved to transcript history (viewable via --recover), but no audio is played.",
    )
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Stop a running background agent.",
    )
    parser.add_argument(
        "--diag",
        action="store_true",
        help="Print diagnostic info (Python, platform, paths, deps, hotkeys, audio device) and exit. Use this to verify the install is wired up correctly.",
    )
    parser.add_argument(
        "--setup",
        action="store_true",
        help="Run the first-run setup wizard: prompts for your Groq API key, offers to install the voice-agent extra, and validates that everything is wired up. Idempotent — safe to re-run.",
    )
    args = parser.parse_args()

    if args.stop:
        _stop_background_agent()
        sys.exit(0)

    if args.diag:
        _print_diagnostics()
        sys.exit(0)

    if args.setup:
        _run_setup_wizard()
        sys.exit(0)

    agent = LocalFlowAgent()

    if args.recover:
        failed_entries = _enumerate_failed_recordings(agent.failed_recordings_dir)
        history_entries = _enumerate_history(agent.history_dir)
        html_path = generate_recovery_console(
            failed_entries,
            history_entries,
            failed_dir=agent.failed_recordings_dir,
            history_dir=agent.history_dir,
            failed_retention_hours=agent.failed_recordings_retention_hours,
            history_retention_hours=agent.history_retention_hours,
        )
        print(f"Recovery console written to: {html_path}")
        print(
            f"  Failed: {len(failed_entries)} (retry re-runs the API)  |  "
            f"Successful: {len(history_entries)} (copy saved text, no API call)"
        )
        if not args.no_open:
            _open_in_browser(html_path)
        sys.exit(0)

    if args.list_failed_recordings:
        _run_list_failed_recordings(agent)
        sys.exit(0)

    if args.list_history:
        _run_list_history(agent)
        sys.exit(0)

    if args.replay_history:
        # No API key required: the text is already on disk.
        result = _replay_history(Path(args.replay_history), paste=args.paste, paste_handler=agent.paste_handler)
        _print_replay_result(result)
        sys.exit(0 if result.get("success") else 1)

    if args.retry_latest_failed or args.retry_failed_recording:
        if not agent.api_key:
            agent.api_key = _ensure_api_key()
        if args.retry_failed_recording:
            result = _retry_failed_recording(
                Path(args.retry_failed_recording),
                paste=args.paste,
                replay_agent=args.retry_agent_query,
                api_key=agent.api_key,
                processing_mode=agent.processing_mode,
                paste_handler=agent.paste_handler,
            )
        else:
            result = _retry_latest_failed(
                agent.failed_recordings_dir,
                paste=args.paste,
                replay_agent=args.retry_agent_query,
                api_key=agent.api_key,
                processing_mode=agent.processing_mode,
                paste_handler=agent.paste_handler,
            )
        _print_retry_result(result)
        sys.exit(0 if result.get("success") else 1)

    if args.format_selection:
        target = args.format_target
        if args.choose_format:
            target = agent.choose_format_target()
        if not target:
            sys.exit(1)
        sys.exit(0 if agent.format_selected_text(target) else 1)

    if args.ghost:
        agent.ghost_mode = True

    if not args.foreground:
        _print_background_banner(agent)
        _launch_in_background()
        sys.exit(0)

    agent.run()


def recover_main() -> None:
    """Console-script entry point for the ``localflow-recover`` command.

    Equivalent to running ``localflow-agent --recover``. Defined separately so
    it can be wired up as its own ``[project.scripts]`` entry point.
    Referenced by ``pyproject.toml`` as
    ``localflow-recover = "localflow_agent:recover_main"``.
    """
    sys.argv = [sys.argv[0] if sys.argv else "localflow-recover"] + ["--recover"] + sys.argv[1:]
    main()


if __name__ == "__main__":
    main()
