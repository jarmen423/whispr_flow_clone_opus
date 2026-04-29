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
    python localflow-agent.py

Configuration:
    Set environment variables in .env file or modify the CONFIG section.
    Key settings include LOCALFLOW_API_URL, LOCALFLOW_HOTKEY, and GROQ_API_KEY.
    On first run, the agent will prompt for a Groq API key and save it to
    ~/.localflow/config.json.

Example:
    $ python localflow-agent.py
    [2024-01-15 10:30:00] [INFO] LocalFlow Desktop Agent
    [2024-01-15 10:30:00] [INFO] Listening for hotkey: alt+l
"""

import os
import sys
import argparse
from pathlib import Path

# Load .env from project root (parent of agent directory)
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"[Config] Loaded environment from {env_path}")
import time
import base64
import io
import threading
import queue
from typing import Optional
from dataclasses import dataclass

# Audio processing
import numpy as np
import sounddevice as sd
from scipy.io import wavfile

# System interaction
import pyperclip
import pyautogui
import requests

# Global hotkey
from pynput import keyboard

# Visual feedback overlay
from recording_overlay import RecordingOverlay

# ============================================
# CONFIGURATION
# ============================================


@dataclass
class Config:
    """Configuration container for the LocalFlow Desktop Agent.

    This dataclass centralizes all configuration parameters for the agent,
    reading values from environment variables with sensible defaults.
    It provides a type-safe, immutable configuration object used throughout
    the application lifecycle.

    Key Technologies/APIs:
        - dataclasses.dataclass: Python 3.7+ class decorator for boilerplate
          reduction and automatic __init__, __repr__ generation
        - os.getenv: Environment variable retrieval with default fallbacks

    Attributes:
        api_url: The API server URL that the agent sends audio to for
            transcription and refinement services.
        api_key: The user's Groq API key for BYOK cloud transcription.
        sample_rate: Audio sampling rate in Hz. 16000 is Whisper.cpp's
            native rate for optimal transcription quality.
        channels: Number of audio channels. Mono (1) is sufficient for
            dictation and reduces bandwidth requirements.
        dtype: Audio data type. "int16" provides 16-bit PCM encoding
            compatible with standard WAV format and Whisper models.
        hotkey: Global hotkey combination string (e.g., "alt+l") that
            triggers recording when pressed and held.
        format_hotkey: Secondary hotkey that enables LLM post-processing
            for formatting and structuring the transcribed text.
        mode: Default processing mode (developer, concise, professional,
            raw, outline) that determines how the LLM refines the text.
        processing_mode: Where processing occurs - "cloud", "networked-local",
            or "local" depending on infrastructure deployment.
        paste_cooldown: Minimum seconds between paste operations to
            prevent accidental rapid-fire text insertion.

    Example:
        >>> config = Config()
        >>> print(config.api_url)
        'https://dictate.agentmemorylabs.com'
        >>> print(config.sample_rate)
        16000
    """

    api_url: str = os.getenv("LOCALFLOW_API_URL", "https://dictate.agentmemorylabs.com")
    api_key: str = os.getenv("GROQ_API_KEY") or os.getenv("LOCALFLOW_API_KEY") or ""
    sample_rate: int = 16000  # Whisper.cpp native rate
    channels: int = 1  # Mono
    dtype: str = "int16"  # 16-bit PCM
    hotkey: str = os.getenv("LOCALFLOW_HOTKEY", "alt+l")
    format_hotkey: str = os.getenv("LOCALFLOW_FORMAT_HOTKEY", "alt+m")
    translate_hotkey: str = os.getenv("LOCALFLOW_TRANSLATE_HOTKEY", "alt+t")  # Toggle translation mode
    cleanup_hotkey: str = os.getenv("LOCALFLOW_CLEANUP_HOTKEY", "alt+n")
    selection_format_hotkey: str = os.getenv("LOCALFLOW_SELECTION_FORMAT_HOTKEY", "alt+j")
    agent_hotkey: str = os.getenv("LOCALFLOW_AGENT_HOTKEY", "alt+a")
    mode: str = os.getenv(
        "LOCALFLOW_MODE", "developer"
    )  # developer, concise, professional, raw, outline
    selection_format_default_target: str = os.getenv("LOCALFLOW_SELECTION_FORMAT_DEFAULT_TARGET", "markdown")
    selection_formatter_enabled: bool = os.getenv("LOCALFLOW_SELECTION_FORMAT_ENABLED", "true").lower() == "true"
    processing_mode: str = os.getenv("PROCESSING_MODE", "cloud")  # cloud, networked-local, local
    paste_cooldown: float = 0.1


CONFIG = Config()

# Config file path for persistent settings
CONFIG_DIR = Path.home() / ".localflow"
CONFIG_FILE = CONFIG_DIR / "config.json"


def _load_config_file() -> dict:
    """Load persistent config from ~/.localflow/config.json if it exists."""
    if CONFIG_FILE.exists():
        try:
            import json
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log_warning(f"Failed to load config file: {e}")
    return {}


def _save_config_file(data: dict) -> None:
    """Save persistent config to ~/.localflow/config.json."""
    try:
        import json
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        log_warning(f"Failed to save config file: {e}")


def _ensure_api_key() -> str:
    """Ensure the agent has a Groq API key. Prompts interactively if missing.

    Checks environment variables and config file. If no key is found,
    prompts the user to enter one and saves it to the config file.
    """
    # Check env vars first
    key = os.getenv("GROQ_API_KEY") or os.getenv("LOCALFLOW_API_KEY") or ""
    if key:
        return key

    # Check config file
    cfg = _load_config_file()
    key = cfg.get("api_key", "")
    if key:
        return key

    # Prompt user interactively
    print("\n" + "=" * 60)
    print("LocalFlow requires a Groq API key for cloud transcription.")
    print("Get your free API key at: https://console.groq.com/keys")
    print("=" * 60 + "\n")
    try:
        key = input("Enter your Groq API key: ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\n")
        sys.exit(1)

    if not key:
        print("No API key provided. Exiting.")
        sys.exit(1)

    # Save to config file
    cfg["api_key"] = key
    _save_config_file(cfg)
    print(f"\nAPI key saved to {CONFIG_FILE}")
    return key


# ============================================
# LOGGING
# ============================================


def log(level: str, message: str) -> None:
    """Output a timestamped log message to stdout.

    This function provides consistent, timestamped logging output used
    throughout the agent for debugging and user feedback. It formats
    messages with ISO-style timestamps and uppercase log levels for
    easy parsing and human readability.

    The logging is intentionally simple (print-based) rather than using
    Python's logging module to minimize dependencies and configuration
    complexity for this desktop application.

    Key Technologies/APIs:
        - time.strftime: POSIX time formatting for consistent timestamps
        - print: Direct stdout output for immediate user visibility

    Args:
        level: The severity level of the message (e.g., "INFO", "ERROR",
            "DEBUG", "WARNING"). Displayed in uppercase.
        message: The actual log content to display. Should be descriptive
            and include relevant context for troubleshooting.

    Returns:
        None: Output is printed directly to stdout.

    Example:
        >>> log("INFO", "Recording started")
        [2024-01-15 10:30:00] [INFO] Recording started
    """
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level.upper()}] {message}")


def log_info(message: str) -> None:
    """Log an informational message.

    A convenience wrapper around log() for standard INFO-level messages.
    Use this for normal operational events that users should see.

    Key Technologies/APIs:
        - Delegates to log() function with level="INFO"

    Args:
        message: Informational message describing normal operation.

    Returns:
        None: Output is printed to stdout via log().

    Example:
        >>> log_info("Connected to server")
        [2024-01-15 10:30:00] [INFO] Connected to server
    """
    log("INFO", message)


def log_error(message: str) -> None:
    """Log an error message.

    A convenience wrapper around log() for ERROR-level messages.
    Use this for failures, exceptions, and unexpected conditions that
    may impact functionality but don't necessarily crash the application.

    Key Technologies/APIs:
        - Delegates to log() function with level="ERROR"

    Args:
        message: Error description including what failed and any
            relevant context for debugging.

    Returns:
        None: Output is printed to stdout via log().

    Example:
        >>> log_error("Failed to connect to server: Connection refused")
        [2024-01-15 10:30:00] [ERROR] Failed to connect to server: Connection refused
    """
    log("ERROR", message)


def log_debug(message: str) -> None:
    """Log a debug message (only when DEBUG environment variable is set).

    A conditional logging function that only outputs when the DEBUG
    environment variable is present. This allows verbose internal state
    logging without cluttering normal operation output.

    Key Technologies/APIs:
        - os.getenv: Checks for DEBUG environment variable presence
        - Delegates to log() function with level="DEBUG" when enabled

    Args:
        message: Debug information for development troubleshooting.
            Can be verbose as it won't display in production.

    Returns:
        None: Output only printed if DEBUG environment variable exists.

    Example:
        >>> os.environ["DEBUG"] = "1"
        >>> log_debug("Audio buffer size: 1024 bytes")
        [2024-01-15 10:30:00] [DEBUG] Audio buffer size: 1024 bytes
    """
    if os.getenv("DEBUG"):
        log("DEBUG", message)


def log_warning(message: str) -> None:
    """Log a warning message.

    A convenience wrapper around log() for WARNING-level messages.
    Use this for concerning but non-fatal conditions that may indicate
    potential issues or suboptimal operation.

    Key Technologies/APIs:
        - Delegates to log() function with level="WARNING"

    Args:
        message: Warning description of the concerning condition.

    Returns:
        None: Output is printed to stdout via log().

    Example:
        >>> log_warning("High CPU usage detected during encoding")
        [2024-01-15 10:30:00] [WARNING] High CPU usage detected during encoding
    """
    log("WARNING", message)


# ============================================
# AUDIO RECORDER
# ============================================


class AudioRecorder:
    """Handles real-time audio capture with push-to-talk functionality.

    This class manages the complete audio recording lifecycle including
    stream initialization, buffer management, and WAV encoding. It uses
    a callback-based architecture with sounddevice for efficient real-time
    audio capture without blocking the main thread.

    The recorder implements a push-to-talk pattern where recording only
    occurs while explicitly enabled, allowing users to control exactly
    when audio is captured via hotkey hold duration.

    Key Technologies/APIs:
        - sounddevice.InputStream: Real-time audio input with callback
          architecture for non-blocking capture
        - numpy.concatenate: Efficient buffer concatenation for audio
          chunks collected during recording
        - scipy.io.wavfile.write: In-memory WAV encoding without
          temporary files using BytesIO
        - threading.Lock: Thread-safe access to audio buffer from
          callback thread and main thread

    Attributes:
        recording: Boolean indicating if currently capturing audio.
        audio_data: List of numpy arrays containing recorded chunks.
        stream: The sounddevice InputStream instance when active.
        lock: Threading lock for safe buffer access.

    Example:
        >>> recorder = AudioRecorder()
        >>> recorder.start()  # Begin recording
        True
        >>> # ... user speaks while holding hotkey ...
        >>> wav_bytes = recorder.stop()  # Returns WAV data
        >>> len(wav_bytes) > 0
        True
    """

    def __init__(self) -> None:
        """Initialize the AudioRecorder with default state.

        Sets up the initial state with empty audio buffers and no active
        stream. The recorder starts in a non-recording state and requires
        an explicit start() call to begin capture.

        Key Technologies/APIs:
            - threading.Lock initialization for thread-safe state management

        Returns:
            None
        """
        self.recording = False
        self.audio_data: list = []
        self.stream: Optional[sd.InputStream] = None
        self.lock = threading.Lock()

    def _audio_callback(self, indata, frames, time_info, status) -> None:
        """SoundDevice callback function for incoming audio data.

        This callback is invoked by the sounddevice library on a separate
        thread whenever new audio data is available from the input device.
        It captures audio chunks into the buffer only when recording is
        active, effectively implementing push-to-talk behavior.

        Key Technologies/APIs:
            - sounddevice InputStream callback: Real-time audio capture
              callback signature (indata, frames, time_info, status)
            - threading.Lock.acquire/release: Thread-safe buffer access
              between callback thread and main thread
            - numpy.ndarray.copy: Deep copy to prevent data corruption

        Args:
            indata: numpy.ndarray containing the audio samples with shape
                (frames, channels) and dtype from stream configuration.
            frames: Number of frames (samples) in this callback invocation.
            time_info: Dictionary with timing information including
                'input_buffer_adc_time', 'current_time', 'output_buffer_dac_time'.
            status: CallbackFlags indicating any stream status issues like
                buffer overruns/underruns.

        Returns:
            None: Audio data is appended to self.audio_data buffer.

        Note:
            This method runs on a separate audio thread managed by
            sounddevice/portaudio, not the main Python thread.
        """
        if status:
            log_error(f"Audio status: {status}")

        if self.recording:
            with self.lock:
                self.audio_data.append(indata.copy())

    def start(self) -> bool:
        """Begin audio recording from the default input device.

        Initializes and starts the sounddevice InputStream with configured
        parameters (sample_rate, channels, dtype). The stream runs in
        callback mode, capturing audio chunks to the internal buffer
        until stop() is called.

        Key Technologies/APIs:
            - sounddevice.InputStream: Audio input stream initialization
              with samplerate, channels, dtype, callback parameters
            - InputStream.start(): Begin audio capture
            - Exception handling for device unavailable scenarios

        Returns:
            bool: True if recording started successfully, False if already
                recording or if the audio device could not be accessed.

        Raises:
            No exceptions are raised; all errors are caught and logged,
            returning False to indicate failure.

        Example:
            >>> recorder = AudioRecorder()
            >>> success = recorder.start()
            >>> print(f"Recording: {success}")
            Recording: True
        """
        if self.recording:
            return False

        try:
            self.audio_data = []
            self.stream = sd.InputStream(
                samplerate=CONFIG.sample_rate,
                channels=CONFIG.channels,
                dtype=CONFIG.dtype,
                callback=self._audio_callback,
                blocksize=1024,
            )
            self.stream.start()
            self.recording = True
            log_info("Recording started")
            return True
        except Exception as e:
            log_error(f"Failed to start recording: {e}")
            return False

    def stop(self) -> Optional[bytes]:
        """Stop recording and return the captured audio as WAV bytes.

        Halts the audio stream, concatenates all recorded chunks into
        a continuous audio buffer, and encodes it as a standard WAV
        file in memory. This method handles the complete teardown of
        the recording session and returns the final audio data ready
        for transmission to the server.

        Key Technologies/APIs:
            - InputStream.stop()/close(): Clean audio stream shutdown
            - numpy.concatenate: Efficient joining of audio chunks
            - scipy.io.wavfile.write: WAV encoding to BytesIO buffer
            - io.BytesIO: In-memory file-like object for WAV data

        Returns:
            Optional[bytes]: WAV-encoded audio data as bytes if recording
                was successful and audio was captured. Returns None if
                not recording, no audio data was captured, or an error
                occurred during processing.

        Raises:
            No exceptions are raised; errors are caught and logged.

        Example:
            >>> recorder = AudioRecorder()
            >>> recorder.start()
            True
            >>> # ... record audio ...
            >>> wav_data = recorder.stop()
            >>> type(wav_data)
            <class 'bytes'>
        """
        if not self.recording:
            return None

        self.recording = False

        try:
            if self.stream:
                self.stream.stop()
                self.stream.close()
                self.stream = None

            with self.lock:
                if not self.audio_data:
                    log_error("No audio data recorded")
                    return None

                # Concatenate all audio chunks
                audio = np.concatenate(self.audio_data, axis=0)

                # Convert to WAV format in memory
                buffer = io.BytesIO()
                wavfile.write(buffer, CONFIG.sample_rate, audio)
                wav_bytes = buffer.getvalue()

                duration = len(audio) / CONFIG.sample_rate
                log_info(f"Recording stopped: {duration:.1f}s, {len(wav_bytes)} bytes")

                return wav_bytes

        except Exception as e:
            log_error(f"Failed to stop recording: {e}")
            return None

    def is_recording(self) -> bool:
        """Check if the recorder is currently capturing audio.

        Returns the current recording state. This is useful for UI
        feedback and preventing concurrent recording attempts.

        Key Technologies/APIs:
            - Simple boolean state check

        Returns:
            bool: True if currently recording (start() was called and
                stop() has not been called yet), False otherwise.

        Example:
            >>> recorder = AudioRecorder()
            >>> recorder.is_recording()
            False
            >>> recorder.start()
            True
            >>> recorder.is_recording()
            True
        """
        return self.recording


# ============================================
# PASTE HANDLER
# ============================================


class PasteHandler:
    """Manages clipboard operations and automated text insertion.

    This class handles the final stage of the dictation workflow:
    taking transcribed text and inserting it at the current cursor
    position in whatever application has focus. It uses a combination
    of clipboard manipulation and keyboard simulation to achieve
    universal text insertion across all applications.

    The handler includes platform-specific logic for paste operations,
    special handling for Windows Terminal, and cooldown protection
    to prevent accidental rapid-fire pasting.

    Key Technologies/APIs:
        - pyperclip.copy: Cross-platform clipboard text setting
        - pyautogui.hotkey: Simulated keyboard shortcuts for paste
        - pyautogui.getActiveWindow: Window detection for special
          handling of applications like Windows Terminal
        - time.sleep: Synchronization delays for clipboard readiness

    Attributes:
        last_paste_time: Unix timestamp of most recent paste operation.
        agent: Reference to parent LocalFlowAgent for keyboard event
            coordination (prevents hotkey detection during paste).

    Example:
        >>> handler = PasteHandler()
        >>> handler.paste_text("Hello, world!")
        True
    """

    def __init__(self, agent=None) -> None:
        """Initialize the PasteHandler.

        Sets up the initial state with no paste history and an optional
        reference to the parent agent for keyboard event coordination.

        Key Technologies/APIs:
            - time.time: Initialize timestamp tracking

        Args:
            agent: Optional reference to the LocalFlowAgent instance.
                Used to set flags that prevent keyboard listener
                interference during paste operations.

        Returns:
            None
        """
        self.last_paste_time = 0
        self.agent = agent  # Reference to agent for keyboard flag

    def copy_selection(self) -> str:
        """Copy the current selection and return the captured clipboard text."""
        try:
            if self.agent:
                self.agent.pasting_in_progress = True

            # Wait for modifier keys (Alt, etc.) to settle before sending Ctrl+C.
            # Without this delay, Ctrl+C fires as Ctrl+Alt+C when called from
            # a GlobalHotKeys callback (Alt key is still physically held).
            time.sleep(0.25)

            # Use a sentinel to detect whether Ctrl+C actually copied anything.
            # If the clipboard equals the sentinel after Ctrl+C, the copy failed
            # (wrong focus, Alt still held, no selection, etc.) and we bail out
            # instead of sending stale clipboard content to the API.
            sentinel = "__WHISPR_COPY_SENTINEL__"
            original_clip = pyperclip.paste()
            pyperclip.copy(sentinel)

            if sys.platform == "darwin":
                pyautogui.hotkey("command", "c")
            else:
                pyautogui.hotkey("ctrl", "c")

            time.sleep(0.2)
            captured = pyperclip.paste() or ""

            if captured == sentinel:
                # Copy failed — restore original clipboard and return empty
                pyperclip.copy(original_clip)
                log_warning("Selection copy failed (clipboard unchanged) — focus was wrong or nothing selected")
                return ""

            log_info(f"Clipboard captured ({len(captured)} chars): {captured[:80]!r}")
            return captured
        finally:
            if self.agent:
                self.agent.pasting_in_progress = False

    def restore_clipboard(self, text: str) -> None:
        """Restore clipboard contents after a temporary overwrite."""
        try:
            pyperclip.copy(text)
        except Exception as e:
            log_warning(f"Failed to restore clipboard: {e}")

    def paste_text(self, text: str) -> bool:
        """Copy text to clipboard and simulate paste at cursor position.

        This is the primary method for inserting transcribed text. It:
        1. Respects the paste cooldown to prevent accidental spam
        2. Sets a flag to disable keyboard listener during paste
        3. Copies the text to the system clipboard via pyperclip
        4. Waits for clipboard to be ready
        5. Simulates the appropriate paste keyboard shortcut
        6. Clears the keyboard listener disable flag

        The method includes special handling for Windows Terminal which
        uses Alt+V instead of Ctrl+V for paste operations.

        Key Technologies/APIs:
            - pyperclip.copy: Cross-platform clipboard text setting
            - pyautogui.getActiveWindow: Active window detection
            - pyautogui.hotkey: Keyboard shortcut simulation with
              platform-specific key combinations
            - time.time/sleep: Cooldown enforcement and synchronization

        Args:
            text: The transcribed and refined text to insert at the
                current cursor position. Should be a non-empty string.

        Returns:
            bool: True if the paste operation completed successfully,
                False if an error occurred during the process.

        Raises:
            No exceptions are raised; all errors are caught and logged.

        Example:
            >>> handler = PasteHandler()
            >>> success = handler.paste_text("This is a test.")
            >>> print(f"Pasted successfully: {success}")
            Pasted successfully: True
        """
        # Respect cooldown
        now = time.time()
        if now - self.last_paste_time < CONFIG.paste_cooldown:
            time.sleep(CONFIG.paste_cooldown)

        try:
            # Set flag to prevent keyboard listener interference
            if self.agent:
                self.agent.pasting_in_progress = True

            # Copy to clipboard
            pyperclip.copy(text)
            log_debug(f"Copied to clipboard: {text[:50]}...")

            # Longer delay for clipboard to be ready
            time.sleep(0.2)

            # Simulate paste (auto-detect Windows Terminal)
            if sys.platform == "darwin":
                pyautogui.hotkey("command", "v")
            else:
                # Detect if Windows Terminal is focused (uses Alt+V)
                try:
                    active_window = pyautogui.getActiveWindow()
                    window_title = active_window.title if active_window else ""
                    # Windows Terminal typically has "Windows Terminal" in title
                    is_windows_terminal = "windows terminal" in window_title.lower()
                    pyautogui.hotkey("alt" if is_windows_terminal else "ctrl", "v")
                except:
                    # Fallback to Ctrl+V if window detection fails
                    pyautogui.hotkey("ctrl", "v")

            # Additional delay to let paste complete
            time.sleep(0.1)

            self.last_paste_time = now
            log_info("Text pasted successfully")
            return True

        except Exception as e:
            log_error(f"Failed to paste: {e}")
            return False
        finally:
            # Clear flag after paste attempt
            if self.agent:
                self.agent.pasting_in_progress = False


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
        - base64.b64encode: Audio data encoding for JSON transmission
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
        self.paste_handler = PasteHandler(self)  # Pass agent reference for keyboard flag
        self.overlay = RecordingOverlay()  # Visual feedback overlay
        self.api_key = CONFIG.api_key
        self.mode = CONFIG.mode
        self.processing_mode = CONFIG.processing_mode
        self.hotkey = CONFIG.hotkey
        self.format_hotkey = CONFIG.format_hotkey
        self.translate_hotkey = CONFIG.translate_hotkey
        self.cleanup_hotkey = CONFIG.cleanup_hotkey
        self.selection_format_hotkey = self._normalize_selection_hotkey(CONFIG.selection_format_hotkey)
        self.selection_format_default_target = CONFIG.selection_format_default_target
        self.selection_formatter_enabled = CONFIG.selection_formatter_enabled
        self.agent_hotkey = CONFIG.agent_hotkey
        self.running = True
        self.hotkey_pressed = False
        self.format_mode_active = False  # True when using Alt+M formatting mode
        self.translate_mode_active = False  # True when using Alt+T translation mode
        self.agent_mode_active = False  # True when using Alt+A voice agent mode
        self.pasting_in_progress = False  # Flag to prevent keyboard listener interference

    def _get_transcribe_endpoint(self) -> str:
        return f"{CONFIG.api_url.rstrip('/')}/api/dictation/transcribe"

    def _transcribe_audio(self, audio_base64: str, translate: bool = False) -> dict:
        """Send audio to the transcription API and return the result.

        POSTs base64-encoded audio to the hosted transcribe endpoint
        with the user's API key for BYOK cloud transcription.

        Args:
            audio_base64: Base64-encoded WAV audio data.
            translate: Whether to translate non-English audio to English.

        Returns:
            dict: API response with keys success, text, wordCount, mode, processingTime.
        """
        try:
            response = requests.post(
                self._get_transcribe_endpoint(),
                json={
                    "audio": audio_base64,
                    "mode": self.processing_mode,
                    "translate": translate,
                    "apiKey": self.api_key,
                },
                timeout=60,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            log_error("Transcription request timed out (60s)")
            return {"success": False, "error": "Transcription timed out"}
        except requests.exceptions.ConnectionError as e:
            log_error(f"Failed to connect to transcription API: {e}")
            return {"success": False, "error": f"Connection failed: {e}"}
        except Exception as e:
            log_error(f"Transcription request failed: {e}")
            return {"success": False, "error": str(e)}

    def _refine_text(self, text: str, mode: str, translate: bool = False) -> dict:
        """Send text to the refinement API and return the result.

        Args:
            text: The raw transcribed text to refine.
            mode: The refinement mode (developer, concise, professional, outline, cleanup).
            translate: Whether the text was translated.

        Returns:
            dict: API response with keys success, refinedText, etc.
        """
        try:
            response = requests.post(
                self._get_refine_endpoint(),
                json={
                    "text": text,
                    "mode": mode,
                    "processingMode": self.processing_mode,
                    "translated": translate,
                },
                timeout=45,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            log_error("Refinement request timed out (45s)")
            return {"success": False, "error": "Refinement timed out"}
        except Exception as e:
            log_error(f"Refinement request failed: {e}")
            return {"success": False, "error": str(e)}

    def _agent_query(self, text: str) -> dict:
        """Send text to the voice agent API and return the answer.

        Args:
            text: The transcribed question text.

        Returns:
            dict: API response with keys success, answer, etc.
        """
        try:
            endpoint = f"{CONFIG.api_url.rstrip('/')}/api/agent/query"
            response = requests.post(
                endpoint,
                json={"text": text},
                timeout=45,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            log_error("Agent query timed out (45s)")
            return {"success": False, "error": "Agent query timed out"}
        except Exception as e:
            log_error(f"Agent query failed: {e}")
            return {"success": False, "error": str(e)}

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

        # Show visual feedback via overlay
        try:
            self.overlay.show()
            # Auto-hide after brief display
            def hide_after_delay():
                time.sleep(1.5)
                if not self.recorder.is_recording():
                    self.overlay.hide()
            threading.Thread(target=hide_after_delay, daemon=True).start()
        except Exception as e:
            log_debug(f"Overlay notification failed: {e}")

    def _start_recording(self, format_mode: bool = False, translate_mode: bool = False, agent_mode: bool = False) -> None:
        """Initiate audio recording session.

        Starts the AudioRecorder and displays the visual overlay.
        Sets the mode flags (format/translate) which determine how
        the transcription is processed.

        Args:
            format_mode: If True, uses LLM formatting/outline mode.
            translate_mode: If True, uses translation mode.
            agent_mode: If True, uses voice agent Q&A mode.

        Returns:
            None
        """
        if self.recorder.start():
            # Show visual feedback
            self.overlay.show()

            # Log mode for debugging (overlay already shows visual animation)
            if agent_mode:
                log_info("🤖 Agent mode recording started")
            elif translate_mode:
                log_info("🌐 Translation mode recording started")
            elif format_mode:
                log_info("📝 Format mode recording started")
            else:
                log_info("Recording started")

            # Set mode flags
            self.format_mode_active = format_mode
            self.translate_mode_active = translate_mode
            self.agent_mode_active = agent_mode

            if format_mode:
                log_info("Format mode activated (Alt+M)")
            if translate_mode:
                log_info("Translation mode activated (Alt+T)")

    def _stop_recording(self) -> None:
        """Stop recording and process audio via the hosted API.

        Halts the audio recorder, hides the visual overlay, encodes
        the captured audio as base64, and sends it to the hosted API
        for transcription and optional refinement.
        """
        # Hide visual feedback
        self.overlay.hide()

        audio_bytes = self.recorder.stop()

        # Determine effective mode
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

        # Convert to base64
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

        log_info(f"Audio captured ({'Translate' if self.translate_mode_active else 'Normal'}), sending to API...")

        # Step 1: Transcribe
        transcribe_result = self._transcribe_audio(audio_base64, self.translate_mode_active)

        if not transcribe_result.get("success"):
            error = transcribe_result.get("error") or transcribe_result.get("details") or "Transcription failed"
            log_error(f"Transcription failed: {error}")
            self.overlay.show_status("Transcription failed", bg_color="#7a2e2e")
            self.format_mode_active = False
            self.translate_mode_active = False
            self.agent_mode_active = False
            return

        raw_text = transcribe_result.get("text", "")
        word_count = transcribe_result.get("wordCount", 0)
        processing_time = transcribe_result.get("processingTime", 0)
        log_info(f"Transcribed: {word_count} words, {processing_time}ms")

        # Step 2: Refine or Agent query (skip for raw mode)
        final_text = raw_text

        if effective_mode == "agent":
            log_info("Sending to voice agent...")
            agent_result = self._agent_query(raw_text)
            if agent_result.get("success"):
                final_text = agent_result.get("answer", "")
                log_info(f"Agent answer: {len(final_text)} chars")
            else:
                error = agent_result.get("error") or "Agent query failed"
                log_error(f"Agent query failed: {error}")
                self.overlay.show_status("Agent failed", bg_color="#7a2e2e")
        elif effective_mode != "raw":
            refine_result = self._refine_text(raw_text, effective_mode, self.translate_mode_active)
            if refine_result.get("success"):
                final_text = refine_result.get("refinedText", raw_text)
                log_info(f"Refined text: {len(final_text)} chars")
            else:
                error = refine_result.get("error") or refine_result.get("details") or "Refinement failed"
                log_warning(f"Refinement failed, using raw text: {error}")
                final_text = raw_text

        # Paste the result
        if final_text:
            self.paste_handler.paste_text(final_text)
        else:
            log_warning("Final text is empty, skipping paste")

        # Reset flags
        self.format_mode_active = False
        self.translate_mode_active = False
        self.agent_mode_active = False

    def _get_refine_endpoint(self) -> str:
        return f"{CONFIG.api_url.rstrip('/')}/api/dictation/refine"

    def _format_text(self, text: str, format_target: str) -> str:
        """Send text to the formatting API and return the formatted result."""
        response = requests.post(
            self._get_refine_endpoint(),
            json={
                "text": text,
                "operation": "text_format",
                "formatTarget": format_target,
                "processingMode": self.processing_mode,
            },
            timeout=45,
        )
        payload = response.json()
        if not response.ok or not payload.get("success"):
            raise RuntimeError(payload.get("details") or payload.get("error") or "Formatting failed")
        formatted_text = payload.get("refinedText", "")
        if not formatted_text:
            raise RuntimeError("Formatter returned empty text")
        return formatted_text

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
            formatted_text = self._format_text(selected_text, target)
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

    def _parse_hotkey(self, hotkey_str: str) -> set:
        """Parse a hotkey string into virtual key codes.

        Converts human-readable hotkey strings like "alt+l" into sets
        of Windows virtual key codes (VK codes) used for low-level
        keyboard event matching. Supports modifier keys (alt, ctrl,
        shift) and special characters.

        Key Technologies/APIs:
            - str.split/str.lower: String parsing and normalization
            - ord(): Character to ASCII/Unicode code point conversion
            - Windows VK codes: Virtual key code constants (164=Alt,
              162=Ctrl, 160=Shift, 191=OEM_2)

        Args:
            hotkey_str: Hotkey combination string like "alt+l",
                "ctrl+shift+f", or "alt+/". Case insensitive.

        Returns:
            set: Set of integer virtual key codes representing the
                parsed hotkey combination.

        Example:
            >>> agent = LocalFlowAgent()
            >>> codes = agent._parse_hotkey("alt+l")
            >>> print(codes)
            {164, 90}
        """
        parts = hotkey_str.lower().replace("+", " ").split()
        vk_codes = set()

        # Virtual key codes for modifier keys
        vk_map = {
            "alt": 164,  # VK_LMENU (left alt)
            "ctrl": 162,  # VK_LCONTROL
            "control": 162,
            "shift": 160,  # VK_LSHIFT
        }

        # Special keys with VK codes different from ASCII
        special_keys = {
            "/": 191,  # VK_OEM_2 (/ ? key)
            "?": 191,  # Same key, shifted
        }

        for part in parts:
            if part in vk_map:
                vk_codes.add(vk_map[part])
            elif part in special_keys:
                vk_codes.add(special_keys[part])
            elif len(part) == 1:
                # For regular characters, use ord() to get the virtual key code
                vk_codes.add(ord(part.upper()))

        log_info(f"Parsed hotkey '{hotkey_str}' -> vk_codes: {vk_codes}")
        return vk_codes

    def _get_vk(self, key) -> Optional[int]:
        """Extract the virtual key code from a pynput Key object.

        Converts pynput keyboard.Key and keyboard.KeyCode objects into
        Windows virtual key codes for cross-platform key matching.
        Handles modifier keys specially due to their platform-specific
        representations.

        Key Technologies/APIs:
            - pynput.keyboard.Key: Special key enumeration (alt_l, ctrl_l, etc.)
            - hasattr reflection: Dynamic attribute checking for key types
            - ord(): Character to key code conversion for KeyCode objects

        Args:
            key: A pynput Key or KeyCode object from keyboard events.

        Returns:
            Optional[int]: The virtual key code if determinable, None
                if the key code cannot be extracted.

        Example:
            >>> from pynput import keyboard
            >>> agent = LocalFlowAgent()
            >>> agent._get_vk(keyboard.Key.alt_l)
            164
        """
        # Handle modifier keys with their vk codes
        modifier_vk_map = {
            keyboard.Key.alt_l: 164,
            keyboard.Key.alt_r: 165,
            keyboard.Key.alt: 164,  # Default to left alt
            keyboard.Key.ctrl_l: 162,
            keyboard.Key.ctrl_r: 163,
            keyboard.Key.ctrl: 162,
            keyboard.Key.shift: 160,
            keyboard.Key.shift_l: 160,
            keyboard.Key.shift_r: 161,
        }

        if key in modifier_vk_map:
            return modifier_vk_map[key]

        # For KeyCode objects
        if hasattr(key, "vk") and key.vk is not None:
            return key.vk

        # For character keys
        if hasattr(key, "char") and key.char:
            return ord(key.char.upper())

        return None

    def _normalize_selection_hotkey(self, hotkey_str: str) -> str:
        """Normalize the selected-text formatter hotkey to a supported combo."""
        normalized = hotkey_str.lower().strip()
        supported = [
            "alt+j",
            "ctrl+j",
            "ctrl+shift+j",
            "ctrl+shift+k",
            "ctrl+shift+f",
        ]
        reserved = {
            self.hotkey.lower(),
            self.format_hotkey.lower(),
            self.translate_hotkey.lower(),
            self.cleanup_hotkey.lower(),
        }
        fallback = next((candidate for candidate in supported if candidate not in reserved), "ctrl+shift+j")
        if normalized not in supported:
            log_warning(
                f"Selection formatter hotkey '{hotkey_str}' is unsupported; using {fallback} instead"
            )
            return fallback

        if normalized in reserved:
            log_warning(
                f"Selection formatter hotkey '{hotkey_str}' conflicts with a recording shortcut; using {fallback} instead"
            )
            return fallback

        return normalized

    def _setup_hotkey_listener(self):
        """Configure global hotkey listeners for recording triggers.

        Sets up two keyboard listeners: a GlobalHotKeys instance for
        detecting hotkey presses (which triggers recording start), and
        a regular Listener for tracking key releases (which triggers
        recording stop). This push-to-talk behavior requires holding
        the hotkey combination for the duration of recording.

        Key Technologies/APIs:
            - pynput.keyboard.GlobalHotKeys: Global hotkey registration
              with automatic callback invocation
            - pynput.keyboard.Listener: Low-level key event monitoring
            - pynput.keyboard.Key: Special key constants for modifier
              detection and release tracking
            - lambda closures: Hotkey callback binding with format_mode

        Returns:
            object: A mock listener object with a stop() method for
                compatibility with the cleanup code in run().

        Note:
            This method must be called from the main thread as keyboard
            listeners have thread-safety requirements on some platforms.
        """
        from pynput.keyboard import GlobalHotKeys, Key, KeyCode

        hotkeys = {}

        # Store hotkey chars locally for release detection
        parts = self.hotkey.lower().replace("+", " ").split()
        format_parts = self.format_hotkey.lower().replace("+", " ").split()
        translate_parts = self.translate_hotkey.lower().replace("+", " ").split()
        cleanup_parts = self.cleanup_hotkey.lower().replace("+", " ").split()
        self.selection_format_hotkey = self._normalize_selection_hotkey(self.selection_format_hotkey)
        selection_parts = self.selection_format_hotkey.lower().replace("+", " ").split()
        
        agent_parts = self.agent_hotkey.lower().replace("+", " ").split()
        hotkey_char = parts[1] if len(parts) >= 2 else "l"
        format_char = format_parts[1] if len(format_parts) >= 2 else "m"
        translate_char = translate_parts[1] if len(translate_parts) >= 2 else "t"
        cleanup_char = cleanup_parts[1] if len(cleanup_parts) >= 2 else "n"
        agent_char = agent_parts[1] if len(agent_parts) >= 2 else "a"
        if len(selection_parts) >= 3 and selection_parts[0] == "ctrl" and selection_parts[1] == "shift":
            selection_char = selection_parts[2]
        elif len(selection_parts) >= 2:
            selection_char = selection_parts[1]
        else:
            selection_char = "j"

        # Register Regular Recording Hotkey
        if parts[0] == "alt":
            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                combo_str = alt_names[alt_key] + "+" + hotkey_char
                hotkeys[combo_str] = lambda: self._on_hotkey_press(format_mode=False, translate_mode=False)

        # Register Format Recording Hotkey
        if format_parts[0] == "alt":
            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                combo_str = alt_names[alt_key] + "+" + format_char
                hotkeys[combo_str] = lambda: self._on_hotkey_press(format_mode=True, translate_mode=False)

        # Register Translate Recording Hotkey
        if translate_parts[0] == "alt":
            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                combo_str = alt_names[alt_key] + "+" + translate_char
                hotkeys[combo_str] = lambda: self._on_hotkey_press(format_mode=False, translate_mode=True)

        # Register Agent Hotkey (Alt+A)
        if len(agent_parts) >= 2 and agent_parts[0] == "alt":
            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                combo_str = alt_names[alt_key] + "+" + agent_char
                hotkeys[combo_str] = lambda: self._on_hotkey_press(agent_mode=True)

        if len(cleanup_parts) >= 2 and cleanup_parts[0] == "alt":
            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                hotkeys[f"{alt_names[alt_key]}+{cleanup_char}"] = (
                    lambda target="cleanup": self._on_selection_hotkey(target)
                )

        if self.selection_formatter_enabled and selection_parts:
            if len(selection_parts) >= 2 and selection_parts[0] == "alt":
                for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                    alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                    hotkeys[f"{alt_names[alt_key]}+{selection_char}"] = (
                        lambda target=self.selection_format_default_target: self._on_selection_hotkey(target)
                    )
            elif len(selection_parts) >= 3 and selection_parts[0] == "ctrl" and selection_parts[1] == "shift":
                for ctrl_name in ["<ctrl_l>", "<ctrl_r>"]:
                    for shift_name in ["<shift_l>", "<shift_r>"]:
                        hotkeys[f"{ctrl_name}+{shift_name}+{selection_char}"] = (
                            lambda target=self.selection_format_default_target: self._on_selection_hotkey(target)
                        )
            elif len(selection_parts) >= 2 and selection_parts[0] == "ctrl":
                for ctrl_name in ["<ctrl_l>", "<ctrl_r>"]:
                    hotkeys[f"{ctrl_name}+{selection_char}"] = (
                        lambda target=self.selection_format_default_target: self._on_selection_hotkey(target)
                    )

        log_info(f"Registering recording hotkeys: {list(hotkeys.keys())}")

        # Create GlobalHotKeys instance
        self.hotkey_listener = GlobalHotKeys(hotkeys)

        # Track pressed keys for release detection
        self.pressed_keys = set()

        def on_press(key):
            if self.pasting_in_progress:
                return
            self.pressed_keys.add(key)

        def on_release(key):
            if self.pasting_in_progress:
                return
            self.pressed_keys.discard(key)

            # Stop recording if ANY of the relevant hotkey parts are released
            if self.hotkey_pressed and self.recorder.is_recording():
                is_alt = key in [Key.alt_l, Key.alt_r, Key.alt_gr, Key.alt]
                
                is_char = False
                if hasattr(key, "char") and key.char:
                    k = key.char.lower()
                    is_char = k in [hotkey_char, format_char, translate_char, cleanup_char, selection_char, agent_char]

                # Double check VK codes for letters
                vk = self._get_vk(key)
                if vk:
                    vks = [ord(c.upper()) for c in [hotkey_char, format_char, translate_char, cleanup_char, selection_char, agent_char]]
                    if vk in vks:
                        is_char = True

                if is_alt or is_char:
                    self.hotkey_pressed = False
                    log_info("Hotkey released! Stopping recording...")
                    self._stop_recording()

        # Start listeners
        self.release_listener = keyboard.Listener(on_press=on_press, on_release=on_release)
        self.release_listener.start()
        self.hotkey_listener.start()

        return type("MockListener", (), {"stop": lambda self: None})()

    def _on_hotkey_press(self, format_mode: bool = False, translate_mode: bool = False, agent_mode: bool = False) -> None:
        """Handle global hotkey press events.

        Initiates recording with the appropriate mode flags.
        """
        if not self.hotkey_pressed:
            self.hotkey_pressed = True
            self._start_recording(format_mode=format_mode, translate_mode=translate_mode, agent_mode=agent_mode)

    def _on_selection_hotkey(self, format_target: str) -> None:
        """Handle the selected-text formatting hotkey without starting recording."""
        if self.recorder.is_recording() or self.pasting_in_progress:
            return
        log_info(f"Formatting selected text as {format_target}")
        self.overlay.show_status(f"{format_target.upper()} requested", bg_color="#24486b", duration=0.8)
        # Run in a background thread so we don't block the GlobalHotKeys callback
        # thread (which would prevent it from processing further key events).
        import threading
        threading.Thread(target=self.format_selected_text, args=(format_target,), daemon=True).start()

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
        # Ensure API key is available
        if not self.api_key:
            self.api_key = _ensure_api_key()

        log_info("=" * 60)
        log_info("LocalFlow Desktop Agent")
        log_info("=" * 60)
        log_info(f"API: {CONFIG.api_url}")
        log_info(f"Hotkey (raw): {self.hotkey}")
        log_info(f"Hotkey (format): {self.format_hotkey}")
        log_info(f"Hotkey (translate): {self.translate_hotkey}")
        log_info(f"Hotkey (cleanup): {self.cleanup_hotkey}")
        log_info(f"Hotkey (selection format): {self.selection_format_hotkey}")
        log_info(f"Mode: {self.mode}")
        log_info(f"Processing: {self.processing_mode}")
        log_info("=" * 60)

        # Set up hotkey listener
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
# MAIN
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


def main() -> None:
    """Application entry point.

    Performs dependency verification and launches the LocalFlowAgent.
    This is the standard entry point when running the script directly.

    Key Technologies/APIs:
        - check_dependencies: Pre-flight dependency verification
        - LocalFlowAgent: Main application controller
        - LocalFlowAgent.run(): Blocking event loop execution

    Returns:
        None: This function blocks during agent operation.

    Example:
        $ python localflow-agent.py
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
    args = parser.parse_args()

    agent = LocalFlowAgent()

    if args.format_selection:
        target = args.format_target
        if args.choose_format:
            target = agent.choose_format_target()
        if not target:
            sys.exit(1)
        sys.exit(0 if agent.format_selected_text(target) else 1)

    agent.run()


if __name__ == "__main__":
    main()
