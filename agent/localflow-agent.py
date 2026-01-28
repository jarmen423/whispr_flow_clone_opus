#!/usr/bin/env python3
"""
LocalFlow Desktop Agent

A system-wide dictation tool that captures audio via global hotkey
and sends it to the LocalFlow server for transcription and refinement.

Usage:
    python localflow-agent.py

Requirements:
    pip install pynput sounddevice scipy python-socketio pyperclip pyautogui numpy

Configuration:
    Set environment variables or modify the CONFIG section below.
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
    """Agent configuration"""

    # WebSocket server URL
    websocket_url: str = os.getenv("LOCALFLOW_WS_URL", "http://localhost:3002")

    # Audio settings
    sample_rate: int = 16000  # Whisper.cpp native rate
    channels: int = 1  # Mono
    dtype: str = "int16"  # 16-bit PCM

    # Hotkey (default: Alt+V)
    hotkey: str = os.getenv("LOCALFLOW_HOTKEY", "alt+z")

    # Processing mode
    mode: str = os.getenv(
        "LOCALFLOW_MODE", "developer"
    )  # developer, concise, professional, raw
    processing_mode: str = os.getenv("PROCESSING_MODE", "networked-local")  # cloud, networked-local, local

    # Heartbeat interval (seconds)
    heartbeat_interval: int = 5

    # Paste cooldown (seconds)
    paste_cooldown: float = 0.1


CONFIG = Config()


# ============================================
# LOGGING
# ============================================


def log(level: str, message: str):
    """Simple logging with timestamp"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level.upper()}] {message}")


def log_info(message: str):
    log("INFO", message)


def log_error(message: str):
    log("ERROR", message)


def log_debug(message: str):
    if os.getenv("DEBUG"):
        log("DEBUG", message)


# ============================================
# AUDIO RECORDER
# ============================================


class AudioRecorder:
    """Handles audio recording with push-to-talk functionality"""

    def __init__(self):
        self.recording = False
        self.audio_data: list = []
        self.stream: Optional[sd.InputStream] = None
        self.lock = threading.Lock()

    def _audio_callback(self, indata, frames, time_info, status):
        """Callback for audio stream"""
        if status:
            log_error(f"Audio status: {status}")

        if self.recording:
            with self.lock:
                self.audio_data.append(indata.copy())

    def start(self) -> bool:
        """Start recording audio"""
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
        """Stop recording and return audio data as WAV bytes"""
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
        """Check if currently recording"""
        return self.recording


# ============================================
# PASTE HANDLER
# ============================================


class PasteHandler:
    """Handles clipboard and paste operations"""

    def __init__(self):
        self.last_paste_time = 0

    def paste_text(self, text: str) -> bool:
        """Copy text to clipboard and simulate paste"""
        # Respect cooldown
        now = time.time()
        if now - self.last_paste_time < CONFIG.paste_cooldown:
            time.sleep(CONFIG.paste_cooldown)

        try:
            # Copy to clipboard
            pyperclip.copy(text)
            log_debug(f"Copied to clipboard: {text[:50]}...")

            # Small delay to ensure clipboard is ready
            time.sleep(0.05)

            # Simulate Ctrl+V (or Cmd+V on macOS)
            if sys.platform == "darwin":
                pyautogui.hotkey("command", "v")
            else:
                pyautogui.hotkey("ctrl", "v")

            self.last_paste_time = time.time()
            log_info("Text pasted successfully")
            return True

        except Exception as e:
            log_error(f"Failed to paste: {e}")
            return False


# ============================================
# LOCALFLOW AGENT
# ============================================


class LocalFlowAgent:
    """Main agent class coordinating all components"""

    def __init__(self):
        self.recorder = AudioRecorder()
        self.paste_handler = PasteHandler()
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
        self.running = True
        self.hotkey_pressed = False

        # Set up Socket.IO event handlers
        self._setup_socket_handlers()

    def _setup_socket_handlers(self):
        """Configure Socket.IO event handlers for /agent namespace"""

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
            """Handle transcription result from server"""
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
            """Handle settings update from server"""
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
        """Connect to WebSocket server"""
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
            import traceback # DEBUG
            traceback.print_exc() # DEBUG
            return False

    def _send_heartbeat(self):
        """Send periodic heartbeat to server"""
        while self.running:
            if self.connected:
                try:
                    self.sio.emit("ping", namespace="/agent")
                except Exception as e:
                    log_debug(f"Heartbeat error: {e}")
            time.sleep(CONFIG.heartbeat_interval)

    def _start_recording(self):
        """Start audio recording"""
        if self.recorder.start():
            # Show visual feedback
            self.overlay.show()
            
            # Notify server
            if self.connected:
                try:
                    self.sio.emit(
                        "recording_started",
                        {"timestamp": int(time.time() * 1000)},
                        namespace="/agent",
                    )
                except Exception as e:
                    log_debug(f"Failed to notify recording start: {e}")

    def _stop_recording(self):
        """Stop recording and send audio to server"""
        # Hide visual feedback
        self.overlay.hide()
        
        audio_bytes = self.recorder.stop()

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
                            "mode": self.mode,
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

    def _parse_hotkey(self, hotkey_str: str):
        """Parse hotkey string into pynput key combination - returns vk codes"""
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
            "/": 191,   # VK_OEM_2 (/ ? key)
            "?": 191,   # Same key, shifted
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

    def _get_vk(self, key):
        """Get virtual key code from a key"""
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
        """Set up global hotkey listener"""
        from pynput.keyboard import GlobalHotKeys, Key, KeyCode

        # Parse the hotkey string
        parts = self.hotkey.lower().replace("+", " ").split()

        # Build hotkey combinations for all Alt variants
        hotkeys = {}

        # For 'alt+l': create combinations for all Alt variants
        if parts[0] == "alt" and len(parts) == 2 and len(parts[1]) == 1:
            target_char = parts[1]

            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                # Create string format for GlobalHotKeys
                alt_names = {
                    Key.alt_l: '<alt_l>',
                    Key.alt_r: '<alt_r>',
                    Key.alt_gr: '<alt_gr>'
                }
                combo_str = alt_names[alt_key] + '+' + target_char
                hotkeys[combo_str] = self._on_hotkey_press

        log_info(f"Registering hotkeys: {list(hotkeys.keys())}")

        # Create GlobalHotKeys instance
        self.hotkey_listener = GlobalHotKeys(hotkeys)

        # Also track key release manually
        self.pressed_keys = set()

        def on_press(key):
            self.pressed_keys.add(key)
            log_debug(f"PRESS: {key}, pressed: {self.pressed_keys}")

        def on_release(key):
            self.pressed_keys.discard(key)
            log_debug(f"RELEASE: {key}, pressed: {self.pressed_keys}")

            # Stop recording if recording and we release the hotkey
            if self.hotkey_pressed and self.recorder.is_recording():
                # Check if released key is Alt or the letter
                if key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                    self.hotkey_pressed = False
                    log_info("Hotkey released! Stopping recording...")
                    self._stop_recording()
                elif hasattr(key, 'char') and key.char and key.char.lower() == parts[1]:
                    self.hotkey_pressed = False
                    log_info("Hotkey released! Stopping recording...")
                    self._stop_recording()

        # Start a regular listener to track key releases
        self.release_listener = keyboard.Listener(on_press=on_press, on_release=on_release)
        self.release_listener.start()

        # Start the hotkey listener
        self.hotkey_listener.start()

        # Return a mock listener object for compatibility
        return type('MockListener', (), {'stop': lambda: None})()

    def _on_hotkey_press(self):
        """Called when hotkey is pressed"""
        if not self.hotkey_pressed:
            self.hotkey_pressed = True
            log_info("Hotkey detected! Starting recording...")
            self._start_recording()

    def run(self):
        """Main run loop"""
        log_info("=" * 60)
        log_info("LocalFlow Desktop Agent")
        log_info("=" * 60)
        log_info(f"Hotkey: {self.hotkey}")
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


def check_dependencies():
    """Check if all required dependencies are installed"""
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


def main():
    """Main entry point"""
    check_dependencies()

    agent = LocalFlowAgent()
    agent.run()


if __name__ == "__main__":
    main()
