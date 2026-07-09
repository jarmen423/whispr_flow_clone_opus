"""
First-run setup wizard for the LocalFlow Desktop Agent.

Purpose:
    Provides an interactive `localflow-agent --setup` command that
    walks a new user through everything they need to get the agent
    working:

      1. Prompts for the Groq API key (required for transcription)
      2. Saves it to ~/.localflow/config.json (idempotent — re-runs
         don't overwrite an existing valid key without confirmation)
      3. Asks whether the user wants the voice-agent (Alt+A) extra,
         which requires installing `voice-computer-use-agent`. If
         yes, attempts to pip-install it into the running tool's
         environment and re-checks `is_available()`.
      4. Validates the install by calling `localflow-agent --diag`
         in-process and printing the dep list
      5. Prints next steps: "run `localflow-agent` to start"

    The wizard is safe to re-run (e.g. after an API key rotation or
    a failed voice-agent install). It is fully terminal-driven — no
    Tkinter, no web — so it works in any install context including
    SSH, headless servers, and freshly-installed Windows VMs.

Dependencies:
    - .config: CONFIG, log_* helpers, _load_config_file, _save_config_file.
    - .agent_bridge: is_available() check for the voice-agent extra.
    - subprocess: pip install for the optional voice-agent extra.
    - getpass: secure API-key entry on terminals that support it
      (falls back to plain input() on Windows PowerShell where
      getpass echoes anyway).

Role in Codebase:
    Imported only by the `main()` entry point in __init__.py via the
    `localflow-agent --setup` CLI flag. Has no other callers.
"""

import getpass
import os
import subprocess
import sys
from typing import Optional

from .config import (
    CONFIG_DIR,
    CONFIG_FILE,
    CLIENT_VERSION,
    _load_config_file,
    _save_config_file,
    log_info,
    log_warning,
    log_error,
)


GROQ_KEY_HELP_URL = "https://console.groq.com/keys"
GROQ_KEY_PREFIX = "gsk_"


def _prompt(question: str, default: Optional[str] = None, allow_empty: bool = False) -> str:
    """Prompt the user for a single line of input.

    Args:
        question: The prompt string (no trailing space/newline).
        default: If non-empty and the user presses Enter, return this.
        allow_empty: If True, treat Enter as a valid answer (empty string).

    Returns:
        The user's input, stripped of leading/trailing whitespace.
    """
    suffix = f" [{default}]" if default else ""
    try:
        raw = input(f"{question}{suffix}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        # EOF (e.g. piped input exhausted, headless run): if the question
        # is a yes/no prompt, default to the safe answer (no). Otherwise
        # return empty so the caller can decide what to do.
        if default is not None:
            return default
        q = question.lower()
        if "yes/no" in q or "(y/n)" in q:
            return "no"
        return ""
    if not raw and default:
        return default
    if not raw and not allow_empty:
        return ""
    return raw


def _prompt_secret(question: str) -> str:
    """Prompt for a secret, hiding the input where possible.

    Falls back to plain input() on Windows PowerShell because getpass
    doesn't work there (it prints a prompt but echoes the input).
    On macOS/Linux terminals, getpass hides the input.
    """
    try:
        if sys.platform == "win32":
            return input(f"{question}: ").strip()
        return getpass.getpass(f"{question}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return ""


def _print_setup_banner() -> None:
    print()
    print("=" * 60)
    print("  LocalFlow Setup Wizard")
    print("=" * 60)
    print()
    print("This wizard configures the LocalFlow desktop agent. It will:")
    print("  1. Save your Groq API key to ~/.localflow/config.json")
    print("  2. Optionally install the voice-agent (Alt+A) extra")
    print("  3. Verify everything is wired up")
    print()
    print("You can re-run this any time with: localflow-agent --setup")
    print()


def _validate_groq_key(key: str) -> Optional[str]:
    """Return an error message if the key looks invalid, else None."""
    if not key:
        return "No key provided."
    if not key.startswith(GROQ_KEY_PREFIX):
        return f"Key doesn't start with '{GROQ_KEY_PREFIX}'. Double-check you copied the full key."
    if len(key) < 20:
        return "Key looks too short. Make sure you copied the full key (not just the prefix)."
    return None


def _save_groq_key(key: str) -> None:
    """Persist the Groq API key to ~/.localflow/config.json."""
    cfg = _load_config_file()
    cfg["api_key"] = key
    _save_config_file(cfg)
    log_info(f"API key saved to {CONFIG_FILE}")


def _generate_voiceuse_config(groq_key: str) -> bool:
    """Write a starter ~/.localflow/voiceuse.yaml so voiceuse can use the same Groq key.

    The file uses the user's just-saved Groq API key for both the LLM
    (llama-3.3-70b-versatile) and STT (whisper-large-v3). Users can edit
    it later to add OpenAI / Anthropic / Cerebras fallbacks.

    Returns True if the file was written, False if VoiceUse isn't installed
    or the file already exists.
    """
    import yaml

    if not _check_voice_agent_available():
        return False

    target = os.path.expanduser("~/.localflow/voiceuse.yaml")
    if os.path.exists(target):
        return False  # don't overwrite

    config = {
        "stt": {
            "provider": "groq",
            "model": "whisper-large-v3",
            "api_key": groq_key,
            "language": "en",
        },
        "llm": {
            "provider": "groq",
            "model": "llama-3.3-70b-versatile",
            "api_key": groq_key,
            "temperature": 0.1,
            "max_tokens": 1024,
        },
        "tts": {
            "provider": "edge",
            "voice": "en-US-AriaNeural",
            "enabled": True,
        },
        "safety": {
            "confirm_destructive": True,
        },
    }
    try:
        with open(target, "w", encoding="utf-8") as f:
            yaml.safe_dump(config, f, default_flow_style=False, sort_keys=False)
        return True
    except Exception as e:
        log_warning(f"Could not write voiceuse config: {e}")
        return False


def _install_voice_agent_extra() -> bool:
    """Install the voice-computer-use-agent extra into the active Python.

    Uses `python -m pip install` against the same interpreter that's
    currently running, so the package lands in the right place for
    the installed tool (uv tool venv, system venv, etc.).

    Returns True on success, False otherwise.
    """
    package = "voice-computer-use-agent"
    log_info(f"Installing {package}...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", package],
            capture_output=True,
            text=True,
            timeout=180,
        )
        if result.returncode != 0:
            log_error(f"pip install failed:\n{result.stderr[-500:]}")
            return False
        log_info(f"{package} installed successfully.")
        return True
    except subprocess.TimeoutExpired:
        log_error("pip install timed out after 180s.")
        return False
    except Exception as e:
        log_error(f"pip install failed: {e}")
        return False


def _check_voice_agent_available() -> bool:
    """Return True if voiceuse is importable in the current environment."""
    try:
        import voiceuse  # noqa: F401
        return True
    except ImportError:
        return False


def _validate_groq_key_against_api(key: str) -> bool:
    """Optional: hit the Groq API to confirm the key works.

    We try a minimal /v1/models request with a short timeout. If the
    network is unavailable or the call fails for any reason we return
    True anyway (the key LOOKS valid by prefix) and let the user find
    out on first transcription.
    """
    try:
        import requests
        response = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=8,
        )
        return response.status_code == 200
    except Exception:
        return True  # network failure shouldn't block setup


def _print_next_steps(voice_agent_ready: bool) -> None:
    print()
    print("=" * 60)
    print("  Setup complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Start the agent:")
    print("       localflow-agent")
    print()
    print("  2. Hold Alt+L to dictate, release to paste.")
    if voice_agent_ready:
        print("  3. Hold Alt+A to ask a question or control your computer by voice.")
    else:
        print("  3. (Optional) Install the voice-agent extra to enable Alt+A:")
        print("       pip install voice-computer-use-agent")
    print()
    print("Run `localflow-agent --diag` any time to see your install status.")
    print("Run `localflow-agent --setup` any time to re-run this wizard.")
    print("Run `localflow-agent --recover` to view past dictations (last 72h).")
    print()


def _setup_wake_word_panel() -> None:
    """TUI panel: configure wake-word and clap detection.

    Opt-in only — leaves the existing "mic-off until you hold a key"
    default intact. Writes results to ~/.localflow/config.json via
    _save_config_file. Safe to re-run.
    """
    print()
    print("Step 3: Wake-word / clap activation (hands-free dictation).")
    print("  Optional. When enabled, your microphone will be always-on")
    print("  listening for the wake word or a double-clap. Both are off by")
    print("  default. Install the optional [wake] extra with:")
    print("    pip install localflow-agent[wake]   (or uv tool install --editable '.[wake]')")
    print()

    cfg = _load_config_file()

    # --- Wake word ---
    current_yn = "yes" if cfg.get("wake_word_enabled", False) else "no"
    answer = _prompt(f"Enable wake-word activation? (yes/no)", default=current_yn).strip().lower()
    wake_enabled = answer.startswith("y")
    cfg["wake_word_enabled"] = wake_enabled

    if wake_enabled:
        cfg["wake_word_dictation_phrase"] = _prompt(
            "Dictation wake phrase (e.g. 'hey computer')",
            default=str(cfg.get("wake_word_dictation_phrase", "hey computer")),
        ).strip() or "hey computer"
        cfg["wake_word_agent_phrase"] = _prompt(
            "Agent-mode wake phrase (e.g. 'okay agent')",
            default=str(cfg.get("wake_word_agent_phrase", "okay agent")),
        ).strip() or "okay agent"
        cfg["wake_word_stop_phrase"] = _prompt(
            "Stop phrase (say to end the recording early)",
            default=str(cfg.get("wake_word_stop_phrase", "end dictation")),
        ).strip() or "end dictation"
        timeout_raw = _prompt(
            "Max recording window in seconds (safety cap, 0 = no limit)",
            default=str(cfg.get("wake_word_timeout_seconds", 60)),
        ).strip()
        try:
            cfg["wake_word_timeout_seconds"] = max(0, int(timeout_raw))
        except ValueError:
            cfg["wake_word_timeout_seconds"] = 60
            log_warning("Invalid timeout value, using default 60s.")

    # --- Clap ---
    clap_yn = "yes" if cfg.get("clap_enabled", False) else "no"
    clap_answer = _prompt(f"Enable double-clap activation? (yes/no)", default=clap_yn).strip().lower()
    clap_enabled = clap_answer.startswith("y")
    cfg["clap_enabled"] = clap_enabled

    if clap_enabled:
        thresh_raw = _prompt(
            "Clap loudness threshold (dBFS, more negative = stricter, e.g. -25)",
            default=str(cfg.get("clap_threshold_db", -25.0)),
        ).strip()
        try:
            cfg["clap_threshold_db"] = float(thresh_raw)
        except ValueError:
            cfg["clap_threshold_db"] = -25.0
            log_warning("Invalid threshold, using default -25.0 dBFS.")

    _save_config_file(cfg)
    log_info("Wake-word / clap settings saved.")

    if wake_enabled or clap_enabled:
        print()
        print("  To start the listener:  localflow-agent --wake-word")
        print("  To verify the install:  localflow-agent --diag")
        print()


def _run_setup_wizard() -> None:
    """Entry point for the `localflow-agent --setup` command."""
    _print_setup_banner()

    # ---- Step 1: Groq API key ----
    existing = _load_config_file().get("api_key", "")
    if existing and not existing.startswith("your_"):
        print(f"Existing API key found: {existing[:8]}...{existing[-4:]}")
        if _prompt("Keep this key? (yes/no)", default="yes").lower().startswith("y"):
            key = existing
        else:
            key = ""
    else:
        key = ""

    if not key:
        print()
        print("Step 1: Groq API key (required for transcription).")
        print(f"  Get a free key at: {GROQ_KEY_HELP_URL}")
        print(f"  Keys start with: '{GROQ_KEY_PREFIX}'")
        print()
        while True:
            candidate = _prompt_secret("Paste your Groq API key")
            err = _validate_groq_key(candidate)
            if err:
                print(f"  ! {err}")
                if _prompt("Try again? (yes/no)", default="yes").lower().startswith("n"):
                    log_error("Setup aborted: no valid API key.")
                    sys.exit(1)
                continue
            # Optional live validation
            if _validate_groq_key_against_api(candidate):
                key = candidate
                break
            else:
                print("  ! The key was rejected by Groq. Please double-check it.")
                if _prompt("Try again? (yes/no)", default="yes").lower().startswith("n"):
                    log_error("Setup aborted: key validation failed.")
                    sys.exit(1)
        _save_groq_key(key)

    # ---- Step 2: Voice agent extra ----
    print()
    print("Step 2: Voice agent (Alt+A) — control your computer by voice.")
    print("  This requires installing the optional 'voice-computer-use-agent'")
    print("  package. It's not needed for plain dictation (Alt+L, Alt+M, etc.).")
    print()
    if _check_voice_agent_available():
        log_info("Voice agent extra is already installed.")
        voice_agent_ready = True
        # Generate ~/.localflow/voiceuse.yaml if it doesn't exist
        if _generate_voiceuse_config(key):
            log_info(f"VoiceUse config written to {os.path.expanduser('~/.localflow/voiceuse.yaml')}")
        else:
            log_info(f"VoiceUse config already exists at {os.path.expanduser('~/.localflow/voiceuse.yaml')} (left untouched)")
    else:
        answer = _prompt("Install voice-agent extra? (yes/no)", default="no").lower()
        if answer.startswith("y"):
            voice_agent_ready = _install_voice_agent_extra() and _check_voice_agent_available()
            if not voice_agent_ready:
                log_warning("Voice agent install failed. You can retry later with:")
                log_warning("  pip install voice-computer-use-agent")
            else:
                if _generate_voiceuse_config(key):
                    log_info(f"VoiceUse config written to {os.path.expanduser('~/.localflow/voiceuse.yaml')}")
        else:
            log_info("Skipped. Install later with: pip install voice-computer-use-agent")
            voice_agent_ready = False

    # ---- Step 3: Wake-word / clap ----
    _setup_wake_word_panel()

    # ---- Step 4: Validate ----
    print()
    print("Step 4: Verifying install...")
    deps_ok = True
    for mod in ("pynput", "sounddevice", "numpy", "scipy", "requests",
                "pyperclip", "pyautogui", "pycaw", "dotenv"):
        try:
            __import__(mod)
        except ImportError:
            log_warning(f"  Missing: {mod}")
            deps_ok = False
    if deps_ok:
        log_info("  All required dependencies importable.")

    # ---- Done ----
    _print_next_steps(voice_agent_ready)
