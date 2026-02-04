#!/usr/bin/env python3
"""LocalFlow Desktop Agent - System-wide dictation client with WebSocket communication.

This module provides the LocalFlow Desktop Agent, a system-wide dictation tool that
captures audio via global hotkeys and transmits it to the LocalFlow server for
real-time transcription and AI-powered refinement. It serves as the client-side
component of the LocalFlow voice-to-text infrastructure.

Purpose & Reasoning:
    The agent was created to provide seamless, hands-free dictation capabilities
    across all applications on the desktop. Unlike traditional dictation software
    that requires switching contexts, this agent uses global hotkeys (via pynput)
    to capture audio at any time, then leverages WebSocket connections (socketio)
    for real-time communication with the LocalFlow server where the actual
    transcription and LLM-based refinement occurs.

Dependencies:
    External Services:
        - LocalFlow WebSocket server (default: localhost:3002)
    
    Python Packages:
        - pynput: Global hotkey listening across all applications
        - sounddevice: Cross-platform audio capture from default input device
        - scipy: WAV file encoding for audio transmission
        - python-socketio: WebSocket client for real-time server communication
        - pyperclip: Clipboard operations for text insertion
        - pyautogui: Cross-platform GUI automation for paste simulation
        - numpy: Audio buffer manipulation and WAV data processing
        - python-dotenv: Environment variable loading from .env files

Role in Codebase:
    This is the primary client-side entry point for desktop users. It is
    instantiated by users running the LocalFlow desktop agent and communicates
    with the LocalFlow server (Node.js/Socket.IO) to process voice dictation.
    The agent handles: hotkey detection, audio capture, server communication,
    and automatic text insertion at the cursor position.

Usage:
    python localflow-agent.py

Configuration:
    Set environment variables in .env file or modify the CONFIG section.
    Key settings include LOCALFLOW_WS_URL, LOCALFLOW_HOTKEY, and LOCALFLOW_MODE.

Example:
    $ python localflow-agent.py
    [2024-01-15 10:30:00] [INFO] LocalFlow Desktop Agent
    [2024-01-15 10:30:00] [INFO] Listening for hotkey: alt+z
"""

import os
import sys
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

# Global hotkey
from pynput import keyboard

# WebSocket client
import socketio

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
        websocket_url: The WebSocket server endpoint URL that the agent
            connects to for audio processing and transcription services.
        sample_rate: Audio sampling rate in Hz. 16000 is Whisper.cpp's
            native rate for optimal transcription quality.
        channels: Number of audio channels. Mono (1) is sufficient for
            dictation and reduces bandwidth requirements.
        dtype: Audio data type. "int16" provides 16-bit PCM encoding
            compatible with standard WAV format and Whisper models.
        hotkey: Global hotkey combination string (e.g., "alt+z") that
            triggers recording when pressed and held.
        format_hotkey: Secondary hotkey that enables LLM post-processing
            for formatting and structuring the transcribed text.
        mode: Default processing mode (developer, concise, professional,
            raw, outline) that determines how the LLM refines the text.
        processing_mode: Where processing occurs - "cloud", "networked-local",
            or "local" depending on infrastructure deployment.
        heartbeat_interval: Seconds between keepalive pings to maintain
            WebSocket connection and detect network issues.
        paste_cooldown: Minimum seconds between paste operations to
            prevent accidental rapid-fire text insertion.

    Example:
        >>> config = Config()
        >>> print(config.websocket_url)
        'http://localhost:3002'
        >>> print(config.sample_rate)
        16000
    """

    websocket_url: str = os.getenv("LOCALFLOW_WS_URL", "http://localhost:3002")
    sample_rate: int = 16000  # Whisper.cpp native rate
    channels: int = 1  # Mono
    dtype: str = "int16"  # 16-bit PCM
    hotkey: str = os.getenv("LOCALFLOW_HOTKEY", "alt+z")
    format_hotkey: str = os.getenv("LOCALFLOW_FORMAT_HOTKEY", "alt+m")
    mode: str = os.getenv(
        "LOCALFLOW_MODE", "developer"
    )  # developer, concise, professional, raw, outline
    processing_mode: str = os.getenv("PROCESSING_MODE", "networked-local")  # cloud, networked-local, local
    heartbeat_interval: int = 5
    paste_cooldown: float = 0.1


CONFIG = Config()


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
    visual feedback, and Socket.IO client for server communication.

    This class implements the core state machine for recording sessions,
    handles WebSocket connection management with automatic reconnection,
    and processes server responses to trigger text insertion.

    Key Technologies/APIs:
        - socketio.Client: WebSocket client with automatic reconnection,
          namespace support (/agent), and event-based message handling
        - pynput.keyboard: Global hotkey registration across all apps
        - threading.Thread: Background heartbeat and overlay threads
        - base64.b64encode: Audio data encoding for JSON transmission
        - time.time: Millisecond timestamps for server synchronization

    Attributes:
        recorder: AudioRecorder instance for audio capture.
        paste_handler: PasteHandler instance for text insertion.
        overlay: RecordingOverlay instance for visual feedback.
        sio: socketio.Client for WebSocket communication.
        connected: Boolean WebSocket connection state.
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
        >>> agent.connect()
        True
        >>> agent.run()  # Blocks until interrupted
    """

    def __init__(self) -> None:
        """Initialize the LocalFlowAgent and all subcomponents.

        Creates instances of all required components (AudioRecorder,
        PasteHandler, RecordingOverlay) and configures the Socket.IO
        client with reconnection parameters. Sets up event handlers
        for the /agent namespace.

        Key Technologies/APIs:
            - socketio.Client: WebSocket client initialization with
              reconnection=True, infinite reconnection_attempts=0,
              reconnection_delay/reconnection_delay_max for backoff
            - Event handler registration via @sio.on decorator

        Returns:
            None
        """
        self.recorder = AudioRecorder()
        self.paste_handler = PasteHandler(self)  # Pass agent reference for keyboard flag
        self.overlay = RecordingOverlay()  # Visual feedback overlay
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=0,  # Infinite
            reconnection_delay=1,
            reconnection_delay_max=5,
        )
        self.connected = False
        self.mode = CONFIG.mode
        self.processing_mode = CONFIG.processing_mode
        self.hotkey = CONFIG.hotkey
        self.format_hotkey = CONFIG.format_hotkey
        self.running = True
        self.hotkey_pressed = False
        self.format_mode_active = False  # True when using Alt+M formatting mode
        self.pasting_in_progress = False  # Flag to prevent keyboard listener interference

        # Set up Socket.IO event handlers
        self._setup_socket_handlers()

    def _setup_socket_handlers(self) -> None:
        """Configure Socket.IO event handlers for the /agent namespace.

        Registers all server event handlers including connection lifecycle
        events (connect, disconnect, connect_error), server confirmations,
        transcription results (dictation_result), and configuration updates
        (settings_update). Each handler updates the appropriate agent state
        and triggers UI or text insertion actions.

        Key Technologies/APIs:
            - socketio.Client.on decorator: Event handler registration
              with namespace="/agent" for scoped events
            - Event handlers: on_connect, on_disconnect, on_connect_error,
              on_connection_confirmed, on_dictation_result, on_settings_update

        Returns:
            None

        Note:
            Handlers are registered as nested functions to capture self
            reference and access agent state directly.
        """

        @self.sio.on("connect", namespace="/agent")
        def on_connect():
            self.connected = True
            log_info(f"Connected to WebSocket server: {CONFIG.websocket_url}")

        @self.sio.on("disconnect", namespace="/agent")
        def on_disconnect():
            self.connected = False
            log_info("Disconnected from WebSocket server")

        @self.sio.on("connect_error", namespace="/agent")
        def on_connect_error(error):
            log_error(f"Connection error: {error}")

        @self.sio.on("connection_confirmed", namespace="/agent")
        def on_connection_confirmed(data):
            log_info(f"Connection confirmed, server time: {data.get('serverTime')}")

        @self.sio.on("dictation_result", namespace="/agent")
        def on_dictation_result(data):
            """Handle transcription result from server.

            Processes the server's dictation_result event containing the
            transcribed and refined text. Extracts the refined text, word
            count, and processing time from the response, then triggers
            paste_text() to insert at the cursor position.

            Key Technologies/APIs:
                - dict.get: Safe dictionary access for optional fields
                - paste_handler.paste_text: Final text insertion

            Args:
                data: Dictionary containing server response with keys:
                    - success (bool): Whether transcription succeeded
                    - refinedText (str): The processed text to insert
                    - wordCount (int): Number of words transcribed
                    - processingTime (int): Server processing time in ms
                    - error (str): Error message if success is False
            """
            if data.get("success"):
                refined_text = data.get("refinedText", "")
                word_count = data.get("wordCount", 0)
                processing_time = data.get("processingTime", 0)

                log_info(f"Received result: {word_count} words, {processing_time}ms")
                log_info(f"Text to paste: '{refined_text}'")

                # Paste the refined text
                if refined_text:
                    self.paste_handler.paste_text(refined_text)
                else:
                    log_warning("Refined text is empty, skipping paste")
            else:
                error = data.get("error", "Unknown error")
                log_error(f"Dictation failed: {error}")

        @self.sio.on("settings_update", namespace="/agent")
        def on_settings_update(data):
            """Handle settings update from server.

            Updates agent configuration based on server-sent settings
            changes. Supports updating mode, processingMode, and hotkey
            configurations dynamically without restart.

            Key Technologies/APIs:
                - dict.get: Safe access to optional update fields
                - log_info: Confirmation logging of applied changes

            Args:
                data: Dictionary containing settings to update:
                    - mode (str): New processing mode
                    - processingMode (str): New processing location
                    - hotkey (str): New hotkey configuration
            """
            if "mode" in data:
                self.mode = data["mode"]
                log_info(f"Mode updated: {self.mode}")

            if "processingMode" in data:
                self.processing_mode = data["processingMode"]
                log_info(f"Processing mode updated: {self.processing_mode}")

            if "hotkey" in data:
                self.hotkey = data["hotkey"]
                log_info(f"Hotkey updated: {self.hotkey}")

    def connect(self) -> bool:
        """Establish WebSocket connection to the LocalFlow server.

        Attempts to connect to the configured WebSocket server with
        multiple transport fallbacks (polling, websocket) and a 10-second
        timeout. Sets up the /agent namespace for scoped communication.

        Key Technologies/APIs:
            - socketio.Client.connect: WebSocket connection with
              namespaces, wait_timeout, and transports parameters
            - Exception handling for connection failures
            - traceback.print_exc: Debug output for connection errors

        Returns:
            bool: True if connection succeeded, False if connection
                failed or timed out.

        Raises:
            No exceptions are raised; all errors are caught and logged.
        """
        try:
            log_info(f"Connecting to {CONFIG.websocket_url}/agent...")
            self.sio.connect(
                CONFIG.websocket_url,
                namespaces=["/agent"],
                wait_timeout=10,
                transports=["polling", "websocket"],
            )
            return True
        except Exception as e:
            log_error(f"Failed to connect: {e}")
            import traceback  # DEBUG
            traceback.print_exc()  # DEBUG
            return False

    def _send_heartbeat(self) -> None:
        """Send periodic heartbeat pings to maintain WebSocket connection.

        Runs in a background thread, sending ping events to the server
        at regular intervals (CONFIG.heartbeat_interval). This keeps
        the connection alive through proxies/firewalls and enables early
        detection of network issues.

        Key Technologies/APIs:
            - socketio.Client.emit: Send ping events on /agent namespace
            - time.sleep: Interval waiting between heartbeats
            - Exception handling for network errors during emit

        Returns:
            None: This method runs indefinitely until self.running is False.

        Note:
            This method is designed to run in a daemon thread. It should
            be started via threading.Thread(target=self._send_heartbeat).
        """
        while self.running:
            if self.connected:
                try:
                    self.sio.emit("ping", namespace="/agent")
                except Exception as e:
                    log_debug(f"Heartbeat error: {e}")
            time.sleep(CONFIG.heartbeat_interval)

    def _start_recording(self, format_mode: bool = False) -> None:
        """Initiate audio recording session.

        Starts the AudioRecorder, displays the visual overlay, and
        notifies the server that recording has begun. Sets the format
        mode flag which determines if LLM post-processing should be
        applied to the transcription.

        Key Technologies/APIs:
            - AudioRecorder.start: Begin audio capture
            - RecordingOverlay.show: Display visual feedback
            - socketio.Client.emit: Notify server of recording start
            - time.time: Millisecond timestamp generation

        Args:
            format_mode: If True, enables LLM post-processing mode
                (outline mode) for structured formatting of the
                transcribed text. Defaults to False.

        Returns:
            None
        """
        if self.recorder.start():
            # Show visual feedback
            self.overlay.show()

            # Set format mode flag
            self.format_mode_active = format_mode
            if format_mode:
                log_info("Format mode activated (Alt+M) - will use Cerebras LLM post-processing")

            # Notify server
            if self.connected:
                try:
                    self.sio.emit(
                        "recording_started",
                        {"timestamp": int(time.time() * 1000), "format_mode": format_mode},
                        namespace="/agent",
                    )
                except Exception as e:
                    log_debug(f"Failed to notify recording start: {e}")

    def _stop_recording(self) -> None:
        """Stop recording and transmit audio to server for processing.

        Halts the audio recorder, hides the visual overlay, encodes
        the captured audio as base64, and sends it to the server via
        the process_audio event. Determines the effective processing
        mode based on whether format mode was active.

        Key Technologies/APIs:
            - RecordingOverlay.hide: Remove visual feedback
            - AudioRecorder.stop: Stop capture and get WAV bytes
            - base64.b64encode: Encode binary audio for JSON transport
            - socketio.Client.emit: Send audio to server with metadata

        Returns:
            None
        """
        # Hide visual feedback
        self.overlay.hide()

        audio_bytes = self.recorder.stop()

        # Determine effective mode based on format_mode_active
        effective_mode = "outline" if self.format_mode_active else self.mode
        if self.format_mode_active:
            log_info(f"Format mode active - using 'outline' mode (base mode: {self.mode})")

        if audio_bytes:
            # Convert to base64
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

            # Send to server
            if self.connected:
                try:
                    self.sio.emit(
                        "process_audio",
                        {
                            "type": "process_audio",
                            "audio": audio_base64,
                            "mode": effective_mode,
                            "processingMode": self.processing_mode,
                            "timestamp": int(time.time() * 1000),
                        },
                        namespace="/agent",
                    )
                    log_info("Audio sent for processing")
                except Exception as e:
                    log_error(f"Failed to send audio: {e}")
            else:
                log_error("Not connected to server")

        # Reset format mode flag after sending
        self.format_mode_active = False

    def _parse_hotkey(self, hotkey_str: str) -> set:
        """Parse a hotkey string into virtual key codes.

        Converts human-readable hotkey strings like "alt+z" into sets
        of Windows virtual key codes (VK codes) used for low-level
        keyboard event matching. Supports modifier keys (alt, ctrl,
        shift) and special characters.

        Key Technologies/APIs:
            - str.split/str.lower: String parsing and normalization
            - ord(): Character to ASCII/Unicode code point conversion
            - Windows VK codes: Virtual key code constants (164=Alt,
              162=Ctrl, 160=Shift, 191=OEM_2)

        Args:
            hotkey_str: Hotkey combination string like "alt+z",
                "ctrl+shift+f", or "alt+/". Case insensitive.

        Returns:
            set: Set of integer virtual key codes representing the
                parsed hotkey combination.

        Example:
            >>> agent = LocalFlowAgent()
            >>> codes = agent._parse_hotkey("alt+z")
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

        # Register regular hotkey (e.g., Alt+L)
        parts = self.hotkey.lower().replace("+", " ").split()
        if parts[0] == "alt" and len(parts) == 2 and len(parts[1]) == 1:
            target_char = parts[1]
            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                combo_str = alt_names[alt_key] + "+" + target_char
                hotkeys[combo_str] = lambda: self._on_hotkey_press(format_mode=False)

        # Register format hotkey (e.g., Alt+M)
        format_parts = self.format_hotkey.lower().replace("+", " ").split()
        if format_parts[0] == "alt" and len(format_parts) == 2 and len(format_parts[1]) == 1:
            format_char = format_parts[1]
            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                combo_str = alt_names[alt_key] + "+" + format_char
                hotkeys[combo_str] = lambda: self._on_hotkey_press(format_mode=True)

        log_info(f"Registering hotkeys: {list(hotkeys.keys())}")

        # Create GlobalHotKeys instance
        self.hotkey_listener = GlobalHotKeys(hotkeys)

        # Also track key release manually
        self.pressed_keys = set()

        def on_press(key):
            if self.pasting_in_progress:
                return  # Ignore keyboard events during paste
            self.pressed_keys.add(key)
            log_debug(f"PRESS: {key}, pressed: {self.pressed_keys}")

        def on_release(key):
            if self.pasting_in_progress:
                return  # Ignore keyboard events during paste
            self.pressed_keys.discard(key)
            log_debug(f"RELEASE: {key}, pressed: {self.pressed_keys}")

            # Stop recording if recording and we release the hotkey
            if self.hotkey_pressed and self.recorder.is_recording():
                # Check if released key is Alt or the letter
                if key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                    self.hotkey_pressed = False
                    log_info("Hotkey released! Stopping recording...")
                    self._stop_recording()
                elif hasattr(key, "char") and key.char and key.char.lower() == parts[1]:
                    self.hotkey_pressed = False
                    log_info("Hotkey released! Stopping recording...")
                    self._stop_recording()

        # Start a regular listener to track key releases
        self.release_listener = keyboard.Listener(on_press=on_press, on_release=on_release)
        self.release_listener.start()

        # Start the hotkey listener
        self.hotkey_listener.start()

        # Return a mock listener object for compatibility
        return type("MockListener", (), {"stop": lambda: None})()

    def _on_hotkey_press(self, format_mode: bool = False) -> None:
        """Handle global hotkey press events.

        Callback invoked when a registered global hotkey is pressed.
        Sets the hotkey_pressed flag and initiates recording with
        the appropriate mode (normal or format mode with LLM processing).

        Key Technologies/APIs:
            - AudioRecorder.start: Begin audio capture
            - RecordingOverlay.show: Visual feedback activation
            - socketio.Client.emit: Server notification of recording start

        Args:
            format_mode: If True, recording will use LLM formatting
                mode for structured output. If False, uses standard
                processing mode. Defaults to False.

        Returns:
            None
        """
        if not self.hotkey_pressed:
            self.hotkey_pressed = True
            if format_mode:
                log_info("Format hotkey (Alt+M) detected! Starting recording with LLM formatting...")
            else:
                log_info("Hotkey detected! Starting recording...")
            self._start_recording(format_mode=format_mode)

    def run(self) -> None:
        """Execute the main agent event loop.

        The primary entry point for agent operation. Displays startup
        information, establishes the WebSocket connection, starts the
        heartbeat thread for connection maintenance, and configures
        global hotkey listeners. Then enters the main loop waiting
        for keyboard interrupts or shutdown signals.

        This method blocks until the agent is stopped via Ctrl+C or
        other interruption mechanism.

        Key Technologies/APIs:
            - threading.Thread: Background heartbeat thread with
              daemon=True for automatic cleanup
            - time.sleep: Event loop throttling (100ms intervals)
            - KeyboardInterrupt handling: Graceful shutdown on Ctrl+C
            - Listener.stop(): Hotkey listener cleanup
            - socketio.Client.disconnect: Clean WebSocket teardown

        Returns:
            None: This method blocks indefinitely during operation.

        Raises:
            No exceptions are raised; KeyboardInterrupt is caught
            for graceful shutdown.

        Example:
            >>> agent = LocalFlowAgent()
            >>> agent.run()  # Blocks here, press Ctrl+C to exit
            [INFO] LocalFlow Desktop Agent
            [INFO] Listening for hotkey: alt+z
            ^C[INFO] Shutting down...
        """
        log_info("=" * 60)
        log_info("LocalFlow Desktop Agent")
        log_info("=" * 60)
        log_info(f"Hotkey (raw): {self.hotkey}")
        log_info(f"Hotkey (format): {self.format_hotkey}")
        log_info(f"Mode: {self.mode}")
        log_info(f"Processing: {self.processing_mode}")
        log_info("=" * 60)

        # Connect to server
        if not self.connect():
            log_error("Failed to connect to server. Retrying in background...")

        # Start heartbeat thread
        heartbeat_thread = threading.Thread(target=self._send_heartbeat, daemon=True)
        heartbeat_thread.start()

        # Set up hotkey listener
        listener = self._setup_hotkey_listener()
        log_info(f"Listening for hotkey: {self.hotkey}")
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
            if self.connected:
                self.sio.disconnect()
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
        import socketio
    except ImportError:
        missing.append("python-socketio")

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

    agent = LocalFlowAgent()
    agent.run()


if __name__ == "__main__":
    main()
