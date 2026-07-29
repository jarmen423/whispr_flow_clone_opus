"""
Global hotkey listener setup for the LocalFlow Desktop Agent.

Purpose & Reasoning:
    This module extracts the hotkey registration logic (``_setup_hotkey_listener``,
    ``_parse_hotkey``, ``_get_vk``, ``_normalize_selection_hotkey``,
    ``_on_hotkey_press``, ``_on_selection_hotkey``) from the agent class so
    the orchestration layer (``__init__.py``) stays focused on lifecycle
    management. The functions accept the agent instance as a parameter rather
    than operating via ``self``, avoiding circular imports.

Dependencies:
    - .config: CONFIG, log_* helpers.
    - pynput.keyboard: Global hotkey registration and key event monitoring.

Role in Codebase:
    Called by ``LocalFlowAgent._setup_hotkey_listener`` in __init__.py.
    Sits at the top of the dependency chain:
        config.py <- recording.py <- api.py <- recovery.py <- hotkeys.py <- __init__.py

Key Technologies/APIs:
    - pynput.keyboard.GlobalHotKeys: Cross-platform global hotkey detection.
    - pynput.keyboard.Listener: Low-level key press/release tracking.
"""

from typing import Callable, Dict, Optional
import time

from pynput import keyboard
from pynput.keyboard import (
    Controller as _KBController,
    HotKey,
    Key,
    Listener as KeyboardListener,
)

from .config import log_info, log_warning, log_debug

# Shared controller for sending synthetic key-up events to clear stuck
# modifiers after injected hotkey combos (see _release_stuck_modifiers).
_kb_controller = _KBController()


def _release_stuck_modifiers() -> None:
    """Send synthetic key-up for all modifier keys at the OS level.

    When Logitech Options+ or AutoHotkey injects a combo like Alt+., the
    OS receives a synthetic Alt↓/Alt↑ pair. If the timing is off or focus
    shifts between the ↓ and ↑ (overlay popup, paste, etc.), the OS can
    leave Alt latched in the keyboard state. Subsequent physical
    keystrokes then get interpreted as Alt-combos — Space becomes
    Alt+Space, 'a' becomes Alt+A (triggering the voice agent with no
    question), etc.

    Sending explicit key-up events for every modifier guarantees a clean
    keyboard state regardless of what the injection tool did. For physical
    keyboard users this is a harmless no-op (the OS already tracked the
    real ↑/↓ pair correctly; a redundant ↑ is ignored).
    """
    for key in (
        Key.alt_l, Key.alt_r,
        Key.ctrl_l, Key.ctrl_r,
        Key.shift_l, Key.shift_r,
    ):
        try:
            _kb_controller.release(key)
        except Exception:
            pass


# Minimum gap between two toggle-press callbacks. pynput's GlobalHotKeys can
# fire the callback on the press edge, and some key combos double-fire on a
# single physical press. Without this debounce a press could instant-start
# then instant-stop a toggle session.
TOGGLE_DEBOUNCE_SECONDS: float = 0.25


class InjectedAwareHotKeys(KeyboardListener):
    """Global hotkey listener that accepts injected keystrokes.

    Why this exists
    ---------------
    pynput's stock ``GlobalHotKeys`` silently drops every key event marked
    ``injected=True`` (see ``GlobalHotKeys._on_press``:
    ``if not injected: ...``).

    Injected events are exactly what these tools produce:

    - Logitech Options+ "Keyboard shortcut" button mappings
    - AutoHotkey ``Send`` / ``SendInput``
    - Other macro utilities that synthesize Alt+L / Alt+.

    Physical keyboard presses work; mouse→keystroke remaps do not — unless
    we accept injected events. That is the whole point of this class.

    Risk note
    ---------
    Accepting injected keys means a runaway macro could re-trigger a hotkey.
    LocalFlow's hotkeys are intentional remaps (mouse buttons, stream-deck
    style tools), so that is the desired behavior. Paste uses Ctrl+V which
    is not a registered recording hotkey.
    """

    def __init__(self, hotkeys: Dict[str, Callable[[], None]], *args, **kwargs):
        """Build hotkey matchers and start listening like GlobalHotKeys.

        Args:
            hotkeys: Map of pynput combo strings (e.g. ``"<alt_l>+l"``) to
                zero-arg callables invoked when the combo fully presses.
        """
        self._hotkeys = [
            HotKey(HotKey.parse(combo), callback)
            for combo, callback in hotkeys.items()
        ]
        super().__init__(
            on_press=self._on_press,
            on_release=self._on_release,
            *args,
            **kwargs,
        )

    def _on_press(self, key, injected: bool = False) -> None:
        """Update hotkey state on key-down, including injected events."""
        # Intentionally no ``if not injected`` guard — see class docstring.
        for hotkey in self._hotkeys:
            hotkey.press(self.canonical(key))

    def _on_release(self, key, injected: bool = False) -> None:
        """Clear hotkey state on key-up, including injected events."""
        for hotkey in self._hotkeys:
            hotkey.release(self.canonical(key))



def _parse_hotkey(hotkey_str: str) -> set:
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
        >>> codes = _parse_hotkey("alt+l")
        >>> print(codes)
        {164, 90}
    """
    parts = hotkey_str.lower().replace("+", " ").split()
    vk_codes = set()

    vk_map = {
        "alt": 164,
        "ctrl": 162,
        "control": 162,
        "shift": 160,
    }

    special_keys = {
        "/": 191,
        "?": 191,
    }

    for part in parts:
        if part in vk_map:
            vk_codes.add(vk_map[part])
        elif part in special_keys:
            vk_codes.add(special_keys[part])
        elif len(part) == 1:
            vk_codes.add(ord(part.upper()))

    log_info(f"Parsed hotkey '{hotkey_str}' -> vk_codes: {vk_codes}")
    return vk_codes


def _get_vk(key) -> Optional[int]:
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
        >>> _get_vk(keyboard.Key.alt_l)
        164
    """
    modifier_vk_map = {
        keyboard.Key.alt_l: 164,
        keyboard.Key.alt_r: 165,
        keyboard.Key.alt: 164,
        keyboard.Key.alt_gr: 165,
        keyboard.Key.ctrl_l: 162,
        keyboard.Key.ctrl_r: 163,
        keyboard.Key.ctrl: 162,
        keyboard.Key.shift: 160,
        keyboard.Key.shift_l: 160,
        keyboard.Key.shift_r: 161,
    }

    if key in modifier_vk_map:
        return modifier_vk_map[key]

    if hasattr(key, "vk") and key.vk is not None:
        return key.vk

    if hasattr(key, "char") and key.char:
        return ord(key.char.upper())

    return None


def _normalize_selection_hotkey(
    hotkey_str: str,
    dictation_hotkey: str,
    format_hotkey: str,
    translate_hotkey: str,
    cleanup_hotkey: str,
) -> str:
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
        dictation_hotkey.lower(),
        format_hotkey.lower(),
        translate_hotkey.lower(),
        cleanup_hotkey.lower(),
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


def setup_hotkey_listener(agent) -> object:
    """Configure global hotkey listeners for recording triggers.

    Sets up two keyboard listeners: a GlobalHotKeys instance for
    detecting hotkey presses (which triggers recording start), and
    a regular Listener for tracking key releases (which triggers
    recording stop). This push-to-talk behavior requires holding
    the hotkey combination for the duration of recording.

    This function accepts the agent instance so it can call its methods
    (``_start_recording``, ``_stop_recording``, ``format_selected_text``)
    without needing a back-reference or circular import.

    Key Technologies/APIs:
        - pynput.keyboard.GlobalHotKeys: Global hotkey registration
          with automatic callback invocation
        - pynput.keyboard.Listener: Low-level key event monitoring
        - pynput.keyboard.Key: Special key constants for modifier
          detection and release tracking

    Args:
        agent: The LocalFlowAgent instance whose methods will be called
            as hotkey callbacks and whose state flags will be read/written.

    Returns:
        object: A mock listener object with a stop() method for
            compatibility with the cleanup code in run().

    Note:
        This function must be called from the main thread as keyboard
        listeners have thread-safety requirements on some platforms.
    """
    from pynput.keyboard import Key

    hotkeys = {}

    parts = agent.hotkey.lower().replace("+", " ").split()
    format_parts = agent.format_hotkey.lower().replace("+", " ").split()
    translate_parts = agent.translate_hotkey.lower().replace("+", " ").split()
    cleanup_parts = agent.cleanup_hotkey.lower().replace("+", " ").split()
    agent.selection_format_hotkey = _normalize_selection_hotkey(
        agent.selection_format_hotkey,
        agent.hotkey,
        agent.format_hotkey,
        agent.translate_hotkey,
        agent.cleanup_hotkey,
    )
    selection_parts = agent.selection_format_hotkey.lower().replace("+", " ").split()

    agent_parts = agent.agent_hotkey.lower().replace("+", " ").split()
    hotkey_char = parts[1] if len(parts) >= 2 else "l"
    format_char = format_parts[1] if len(format_parts) >= 2 else "m"
    translate_char = translate_parts[1] if len(translate_parts) >= 2 else "t"
    cleanup_char = cleanup_parts[1] if len(cleanup_parts) >= 2 else "n"
    agent_char = agent_parts[1] if len(agent_parts) >= 2 else "a"

    # Toggle dictation: press once to start, press again to stop. Two slots
    # (alt+. and ctrl+. by default) are bound to the same toggle behavior so a
    # fallback exists when an app hijacks one combo.
    toggle_parts = agent.toggle_hotkey.lower().replace("+", " ").split()
    toggle_secondary_parts = agent.toggle_hotkey_secondary.lower().replace("+", " ").split()
    toggle_char = toggle_parts[1] if len(toggle_parts) >= 2 else "."
    toggle_secondary_char = toggle_secondary_parts[1] if len(toggle_secondary_parts) >= 2 else "."
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
            hotkeys[combo_str] = lambda: _on_hotkey_press(agent, format_mode=False, translate_mode=False)

    # Register Format Recording Hotkey
    if format_parts[0] == "alt":
        for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
            alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
            combo_str = alt_names[alt_key] + "+" + format_char
            hotkeys[combo_str] = lambda: _on_hotkey_press(agent, format_mode=True, translate_mode=False)

    # Register Translate Recording Hotkey
    if translate_parts[0] == "alt":
        for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
            alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
            combo_str = alt_names[alt_key] + "+" + translate_char
            hotkeys[combo_str] = lambda: _on_hotkey_press(agent, format_mode=False, translate_mode=True)

    # Register Agent Hotkey (Alt+A)
    if len(agent_parts) >= 2 and agent_parts[0] == "alt":
        for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
            alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
            combo_str = alt_names[alt_key] + "+" + agent_char
            hotkeys[combo_str] = lambda: _on_hotkey_press(agent, agent_mode=True)

    # Register Toggle Dictation Hotkey (primary slot, e.g. alt+.)
    if len(toggle_parts) >= 2 and toggle_parts[0] == "alt":
        for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
            alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
            combo_str = alt_names[alt_key] + "+" + toggle_char
            # Skip combos already claimed by a hold/agent/selection hotkey so a
            # misconfigured toggle key cannot silently shadow it.
            if combo_str in hotkeys:
                log_warning(
                    f"Toggle hotkey '{agent.toggle_hotkey}' collides with an existing "
                    f"recording hotkey ({combo_str}); skipping to avoid shadowing it"
                )
                continue
            hotkeys[combo_str] = lambda: _on_toggle_hotkey_press(agent)

    # Register Toggle Dictation Hotkey (secondary slot, e.g. ctrl+.)
    if len(toggle_secondary_parts) >= 2 and toggle_secondary_parts[0] == "ctrl":
        for ctrl_name in ["<ctrl_l>", "<ctrl_r>"]:
            combo_str = f"{ctrl_name}+{toggle_secondary_char}"
            if combo_str in hotkeys:
                log_warning(
                    f"Toggle hotkey '{agent.toggle_hotkey_secondary}' collides with an existing "
                    f"recording hotkey ({combo_str}); skipping to avoid shadowing it"
                )
                continue
            hotkeys[combo_str] = lambda: _on_toggle_hotkey_press(agent)

    if len(cleanup_parts) >= 2 and cleanup_parts[0] == "alt":
        for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
            alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
            hotkeys[f"{alt_names[alt_key]}+{cleanup_char}"] = (
                lambda target="cleanup": _on_selection_hotkey(agent, target)
            )

    if agent.selection_formatter_enabled and selection_parts:
        if len(selection_parts) >= 2 and selection_parts[0] == "alt":
            for alt_key in [Key.alt_l, Key.alt_r, Key.alt_gr]:
                alt_names = {Key.alt_l: "<alt_l>", Key.alt_r: "<alt_r>", Key.alt_gr: "<alt_gr>"}
                hotkeys[f"{alt_names[alt_key]}+{selection_char}"] = (
                    lambda target=agent.selection_format_default_target: _on_selection_hotkey(agent, target)
                )
        elif len(selection_parts) >= 3 and selection_parts[0] == "ctrl" and selection_parts[1] == "shift":
            for ctrl_name in ["<ctrl_l>", "<ctrl_r>"]:
                for shift_name in ["<shift_l>", "<shift_r>"]:
                    hotkeys[f"{ctrl_name}+{shift_name}+{selection_char}"] = (
                        lambda target=agent.selection_format_default_target: _on_selection_hotkey(agent, target)
                    )
        elif len(selection_parts) >= 2 and selection_parts[0] == "ctrl":
            for ctrl_name in ["<ctrl_l>", "<ctrl_r>"]:
                hotkeys[f"{ctrl_name}+{selection_char}"] = (
                    lambda target=agent.selection_format_default_target: _on_selection_hotkey(agent, target)
                )

    log_info(f"Registering recording hotkeys: {list(hotkeys.keys())}")
    # InjectedAwareHotKeys (not pynput GlobalHotKeys): accepts Logi Options+
    # and AutoHotkey synthetic keystrokes. See class docstring for why.
    agent.hotkey_listener = InjectedAwareHotKeys(hotkeys)

    agent.pressed_keys = set()

    def on_press(key, injected=False):
        if agent.pasting_in_progress:
            return
        agent.pressed_keys.add(key)

    def on_release(key, injected=False):
        if agent.pasting_in_progress:
            return
        agent.pressed_keys.discard(key)

        # Only hold-to-record sessions are stopped by key release. Toggle
        # sessions (recording_source == "toggle") must keep recording until the
        # user presses the toggle combo again. This gate is the single most
        # critical guard separating the two modes.
        if (
            agent.hotkey_pressed
            and agent.recorder.is_recording()
            and agent.recording_source == "hold"
        ):
            is_alt = key in [Key.alt_l, Key.alt_r, Key.alt_gr, Key.alt]

            # The release-stop set covers only the configured hold hotkey
            # terminal chars. Toggle chars are intentionally excluded: a toggle
            # session is gated out of this handler entirely (recording_source
            # != "hold"), so including them would let a stray period-key release
            # prematurely stop an in-progress hold session.
            hold_chars = [
                hotkey_char, format_char, translate_char,
                cleanup_char, selection_char, agent_char,
            ]

            is_char = False
            if hasattr(key, "char") and key.char:
                k = key.char.lower()
                is_char = k in hold_chars

            vk = _get_vk(key)
            if vk:
                vks = [ord(c.upper()) for c in hold_chars]
                if vk in vks:
                    is_char = True

            if is_alt or is_char:
                agent.hotkey_pressed = False
                log_info("Hotkey released! Stopping recording...")
                agent._stop_recording()

    agent.release_listener = keyboard.Listener(on_press=on_press, on_release=on_release)
    agent.release_listener.start()
    agent.hotkey_listener.start()

    return type("MockListener", (), {"stop": lambda self: None})()


def _on_hotkey_press(agent, format_mode: bool = False, translate_mode: bool = False, agent_mode: bool = False) -> None:
    """Handle global hotkey press events.

    Initiates a hold-to-record session with the appropriate mode flags. The
    session is tagged ``source="hold"`` so the release listener auto-stops it
    when the hotkey is released.

    The ``is_recording()`` guard is the reciprocal of the toggle callback's
    hold guard. Without it, pressing a hold hotkey during an active toggle
    recording would latch ``hotkey_pressed`` True while ``recorder.start()``
    returns False -- and since on_release only clears ``hotkey_pressed`` for
    hold sessions, that latch would never release, permanently breaking
    hold-to-record until the process restarts.
    """
    if agent.hotkey_pressed or agent.recorder.is_recording():
        return
    agent.hotkey_pressed = True
    agent._start_recording(
        format_mode=format_mode,
        translate_mode=translate_mode,
        agent_mode=agent_mode,
        source="hold",
    )


def _on_toggle_hotkey_press(agent) -> None:
    """Handle the toggle dictation hotkey (press once to start, again to stop).

    Toggle mode is independent of hold-to-record: it never sets
    ``agent.hotkey_pressed`` (the hold-mode latch), so the key-release listener
    will not stop a toggle session on release. A second press calls
    ``_stop_recording`` to finish, transcribe (raw dictation), and paste.

    Guards:
        - Debounce: ignores a second callback within
          ``TOGGLE_DEBOUNCE_SECONDS`` so a single physical press cannot
          instant-start then instant-stop a session (pynput can double-fire).
        - Cross-mode: if a hold recording is active, the toggle is ignored so
          the two modes never fight over the recorder.
    """
    now = time.time()
    if now - agent.last_toggle_time < TOGGLE_DEBOUNCE_SECONDS:
        log_debug("Toggle ignored: within debounce window")
        return
    agent.last_toggle_time = now

    # Don't interfere with an active hold-to-record session.
    if agent.recorder.is_recording() and agent.recording_source == "hold":
        log_debug("Toggle ignored: hold recording active")
        return

    # Clear any modifier keys left latched by the injection tool BEFORE
    # acting. Logi Options+ sends a synthetic Alt↓ .↓ .↑ Alt↑ burst; if
    # the Alt↑ is lost (focus shift, overlay popup), the OS keeps Alt held
    # and subsequent events — including the paste inside _stop_recording —
    # get interpreted as Alt-combos. Toggle mode never uses the release
    # listener (recording_source != "hold"), so these synthetic key-ups
    # cannot prematurely stop a recording.
    _release_stuck_modifiers()

    if agent.recorder.is_recording():
        log_info("Toggle dictation: stopping recording")
        agent._stop_recording()
    else:
        log_info("Toggle dictation: starting recording")
        agent._start_recording(source="toggle")


def _on_selection_hotkey(agent, format_target: str) -> None:
    """Handle the selected-text formatting hotkey without starting recording."""
    if agent.recorder.is_recording() or agent.pasting_in_progress:
        return
    log_info(f"Formatting selected text as {format_target}")
    agent.overlay.show_status(f"{format_target.upper()} requested", bg_color="#24486b", duration=0.8)
    # Same rationale as in _on_toggle_hotkey_press: clear latched modifiers
    # left behind by the injection tool so subsequent typing is clean.
    _release_stuck_modifiers()
    import threading
    threading.Thread(target=agent.format_selected_text, args=(format_target,), daemon=True).start()
