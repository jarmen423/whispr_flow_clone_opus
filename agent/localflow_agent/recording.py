"""
Audio capture and text paste functionality for the LocalFlow Desktop Agent.

Purpose & Reasoning:
    This module contains the two device-interaction classes that sit
    between the user's hardware and the agent's orchestration layer.
    ``AudioRecorder`` captures system audio via sounddevice and encodes
    it as WAV bytes. ``PasteHandler`` places processed text at the
    current cursor position using clipboard and keyboard simulation.

Dependencies:
    - .config: CONFIG singleton, log_* helpers.
    - numpy, sounddevice, scipy.io.wavfile: Audio capture and WAV encoding.
    - pyperclip, pyautogui: Clipboard access and keyboard simulation.
    - threading, io: Thread safety and in-memory WAV buffers.

Role in Codebase:
    Imported by api.py (recovery needs PasteHandler) and __init__.py
    (agent instantiates both classes). Depends only on config.py.

Key Technologies/APIs:
    - sounddevice.InputStream: Real-time audio callback stream.
    - pyautogui.hotkey: Cross-platform keyboard shortcut simulation.
    - pyperclip.copy / paste: System clipboard read/write.
"""

import io
import sys
import time
import threading
from typing import Optional

import numpy as np
import sounddevice as sd
from scipy.io import wavfile
import pyperclip
import pyautogui

from .config import CONFIG, log_info, log_error, log_warning, log_debug


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

                audio = np.concatenate(self.audio_data, axis=0)

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
        agent: Reference to parent agent for keyboard event
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
        self.agent = agent

    def copy_selection(self) -> str:
        """Copy the current selection and return the captured clipboard text."""
        try:
            if self.agent:
                self.agent.pasting_in_progress = True

            time.sleep(0.25)

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
        now = time.time()
        if now - self.last_paste_time < CONFIG.paste_cooldown:
            time.sleep(CONFIG.paste_cooldown)

        try:
            if self.agent:
                self.agent.pasting_in_progress = True

            pyperclip.copy(text)
            log_debug(f"Copied to clipboard: {text[:50]}...")

            time.sleep(0.2)

            if sys.platform == "darwin":
                pyautogui.hotkey("command", "v")
            else:
                try:
                    active_window = pyautogui.getActiveWindow()
                    window_title = active_window.title if active_window else ""
                    is_windows_terminal = "windows terminal" in window_title.lower()
                    pyautogui.hotkey("alt" if is_windows_terminal else "ctrl", "v")
                except:
                    pyautogui.hotkey("ctrl", "v")

            time.sleep(0.1)

            self.last_paste_time = now
            log_info("Text pasted successfully")
            return True

        except Exception as e:
            log_error(f"Failed to paste: {e}")
            return False
        finally:
            if self.agent:
                self.agent.pasting_in_progress = False
