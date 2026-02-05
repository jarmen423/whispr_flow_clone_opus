#!/usr/bin/env python3
"""Test script for hotkey press/release detection.

This script tests the VK-code-based hotkey tracking without requiring
a WebSocket connection. It just prints when hotkey is pressed/released.
"""

import sys
import time
from unittest.mock import MagicMock

# Mock the imports that might not be available
sys.modules['numpy'] = MagicMock()
sys.modules['sounddevice'] = MagicMock()
sys.modules['socketio'] = MagicMock()
sys.modules['requests'] = MagicMock()
sys.modules['dotenv'] = MagicMock()

from pynput import keyboard
from pynput.keyboard import GlobalHotKeys, Key

# VK codes for tracking
ALT_VK_CODES = {164, 165}  # Left Alt, Right Alt
HOTKEY_VK = ord('L')  # 76

print("=" * 60)
print("Hotkey Test Script")
print("=" * 60)
print(f"Hotkey: Alt+L (vk={HOTKEY_VK})")
print("Hold Alt+L to see 'RECORDING START'")
print("Release to see 'RECORDING STOP'")
print("Press Ctrl+C to exit")
print("=" * 60)

# State
pressed_vks = set()
hotkey_triggered = False
is_recording = False

def get_vk(key):
    """Extract VK code from key."""
    modifier_vk_map = {
        Key.alt_l: 164,
        Key.alt_r: 165,
        Key.alt: 164,
        Key.alt_gr: 165,
    }
    if key in modifier_vk_map:
        return modifier_vk_map[key]
    if hasattr(key, "vk") and key.vk is not None:
        return key.vk
    if hasattr(key, "char") and key.char:
        return ord(key.char.upper())
    return None

# GlobalHotKeys for press detection
hotkeys = {
    "<alt_l>+l": lambda: on_hotkey_press(),
    "<alt_r>+l": lambda: on_hotkey_press(),
    "<alt_gr>+l": lambda: on_hotkey_press(),
}

def on_hotkey_press():
    """Called when hotkey is pressed."""
    global hotkey_triggered, is_recording
    if not hotkey_triggered:
        hotkey_triggered = True
        is_recording = True
        print("[HOTKEY] RECORDING STARTED!")

def on_press(key):
    """Track key presses."""
    vk = get_vk(key)
    if vk is not None:
        pressed_vks.add(vk)
        # Suppress hotkey combinations
        if pressed_vks & ALT_VK_CODES:  # Alt is pressed
            if vk == HOTKEY_VK:
                return False
    return True

def on_release(key):
    """Handle key releases."""
    global hotkey_triggered, is_recording
    
    vk = get_vk(key)
    
    # Check if this is a hotkey-related release that should stop recording
    if hotkey_triggered and is_recording:
        is_alt = vk in ALT_VK_CODES
        is_hotkey_char = vk == HOTKEY_VK
        
        if is_alt or is_hotkey_char:
            print("[HOTKEY] RECORDING STOPPED!")
            hotkey_triggered = False
            is_recording = False
            if vk is not None:
                pressed_vks.discard(vk)
            return False
    
    # Normal release - clean up
    if vk is not None:
        pressed_vks.discard(vk)
    
    # Reset hotkey triggered if we're no longer recording
    if hotkey_triggered and not is_recording:
        hotkey_triggered = False
    
    return True

# Start listeners
hotkey_listener = GlobalHotKeys(hotkeys)
hotkey_listener.start()

release_listener = keyboard.Listener(on_press=on_press, on_release=on_release)
release_listener.start()

print("\nListeners started. Hold Alt+L to test...")

try:
    while True:
        time.sleep(0.1)
except KeyboardInterrupt:
    print("\nStopping...")
    hotkey_listener.stop()
    release_listener.stop()
    print("Done!")
