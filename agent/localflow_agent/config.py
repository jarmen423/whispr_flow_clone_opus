"""
Configuration, environment loading, and logging for the LocalFlow Desktop Agent.

Purpose & Reasoning:
    This module centralises all runtime configuration so the rest of the agent
    simply imports ``CONFIG`` or calls the logging helpers. Keeping config in a
    separate module avoids circular imports and makes it easy to test the
    settings layer independently from audio capture and API calls.

Dependencies:
    - python-dotenv: Loads .env files into os.environ before Config reads them.
    - pathlib: Cross-platform filesystem paths for the config directory/file.
    - dataclasses: Immutable, type-safe configuration container.

Role in Codebase:
    Every other module inside ``localflow_agent`` imports from this module.
    It is the leaf node in the dependency chain:
        config.py <- recording.py <- api.py <- recovery.py <- hotkeys.py <- __init__.py

Key Technologies/APIs:
    - dotenv.load_dotenv: populates os.environ from a layered set of .env paths.
    - dataclasses.dataclass: auto-generated __init__/__repr__ for Config.
    - os.getenv / Path.home / json: persistent config file read/write.
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

from dotenv import load_dotenv


# ---------------------------------------------------------------------------
# Environment-file resolution (layered: explicit -> user-dir -> cwd -> repo)
# ---------------------------------------------------------------------------

def _resolve_env_path() -> Optional[Path]:
    """Return the first available .env path from a layered search order."""
    candidates = []
    explicit = os.getenv("LOCALFLOW_ENV_FILE")
    if explicit:
        candidates.append(Path(explicit).expanduser())
    candidates.append(Path.home() / ".localflow" / ".env")
    candidates.append(Path.cwd() / ".env")
    # Source-checkout fallback: agent/localflow_agent/__init__.py -> repo root
    repo_root = Path(__file__).resolve().parent.parent.parent
    if (repo_root / "agent" / "localflow_agent" / "__init__.py").exists():
        candidates.append(repo_root / ".env")
    for candidate in candidates:
        try:
            if candidate.is_file():
                return candidate
        except OSError:
            continue
    return None


env_path = _resolve_env_path()
if env_path:
    load_dotenv(env_path)
    print(f"[Config] Loaded environment from {env_path}")


# ---------------------------------------------------------------------------
# Typed env helpers
# ---------------------------------------------------------------------------

def _env_bool(name: str, default: bool) -> bool:
    """Parse a boolean environment variable without raising on odd values."""
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() not in ("0", "false", "no", "off")


def _env_float(name: str, default: float) -> float:
    """Parse a numeric environment variable without failing during import."""
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return float(raw_value)
    except ValueError:
        return default


# ---------------------------------------------------------------------------
# Configuration singleton
# ---------------------------------------------------------------------------

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
        save_failed_recordings: Whether the agent keeps recoverable WAV files
            when transcription fails before any text is returned.
        failed_recordings_dir: Directory used for failed recording recovery
            files and JSON sidecars.
        failed_recordings_retention_hours: Number of hours to retain failed
            recording files before automatic cleanup removes them.
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
    sample_rate: int = 16000
    channels: int = 1
    dtype: str = "int16"
    hotkey: str = os.getenv("LOCALFLOW_HOTKEY", "alt+l")
    format_hotkey: str = os.getenv("LOCALFLOW_FORMAT_HOTKEY", "alt+m")
    translate_hotkey: str = os.getenv("LOCALFLOW_TRANSLATE_HOTKEY", "alt+t")
    cleanup_hotkey: str = os.getenv("LOCALFLOW_CLEANUP_HOTKEY", "alt+n")
    selection_format_hotkey: str = os.getenv("LOCALFLOW_SELECTION_FORMAT_HOTKEY", "alt+j")
    agent_hotkey: str = os.getenv("LOCALFLOW_AGENT_HOTKEY", "alt+a")
    # Toggle dictation slots: press once to start, press again to stop. These are
    # distinct from the hold-to-record hotkeys above. Two slots are bound to the
    # same toggle behavior so a fallback exists if an app hijacks one combo.
    toggle_hotkey: str = os.getenv("LOCALFLOW_TOGGLE_HOTKEY", "alt+.")
    toggle_hotkey_secondary: str = os.getenv("LOCALFLOW_TOGGLE_HOTKEY_2", "ctrl+.")
    mode: str = os.getenv(
        "LOCALFLOW_MODE", "developer"
    )
    selection_format_default_target: str = os.getenv("LOCALFLOW_SELECTION_FORMAT_DEFAULT_TARGET", "markdown")
    selection_formatter_enabled: bool = os.getenv("LOCALFLOW_SELECTION_FORMAT_ENABLED", "true").lower() == "true"
    processing_mode: str = os.getenv("PROCESSING_MODE", "cloud")
    save_failed_recordings: bool = _env_bool("LOCALFLOW_SAVE_FAILED_RECORDINGS", True)
    failed_recordings_dir: str = os.getenv(
        "LOCALFLOW_FAILED_RECORDINGS_DIR",
        str(Path.home() / ".localflow" / "failed-recordings"),
    )
    failed_recordings_retention_hours: float = _env_float("LOCALFLOW_FAILED_RECORDINGS_RETENTION_HOURS", 72.0)
    # Successful-transcription history (text only). Unlike failed-recording
    # recovery this keeps the returned text, NOT the audio, so a successful
    # dictation can be re-grabbed from the Recovery Console without re-running
    # the API. Covers non-API failures: released the hotkey mid-sentence,
    # paste didn't land, keyboard didn't register, etc.
    save_history: bool = _env_bool("LOCALFLOW_SAVE_HISTORY", True)
    history_dir: str = os.getenv(
        "LOCALFLOW_HISTORY_DIR",
        str(Path.home() / ".localflow" / "history"),
    )
    history_retention_hours: float = _env_float("LOCALFLOW_HISTORY_RETENTION_HOURS", 72.0)
    paste_cooldown: float = 0.1
    # Ghost mode: suppress TTS for agent responses (Alt+A). The agent's
    # text response is still pasted at the cursor AND saved to the
    # transcript history (viewable via `localflow-agent --recover`),
    # but no audio is played.
    ghost_mode: bool = _env_bool("LOCALFLOW_GHOST_MODE", False)


CONFIG = Config()

CLIENT_VERSION = "2"

CONFIG_DIR = Path.home() / ".localflow"
CONFIG_FILE = CONFIG_DIR / "config.json"


# ---------------------------------------------------------------------------
# Persistent config file helpers
# ---------------------------------------------------------------------------

def _load_config_file() -> dict:
    """Load persistent config from ~/.localflow/config.json if it exists."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log_warning(f"Failed to load config file: {e}")
    return {}


def _save_config_file(data: dict) -> None:
    """Save persistent config to ~/.localflow/config.json."""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        log_warning(f"Failed to save config file: {e}")


def _bool_setting(config_data: dict, key: str, env_name: str, default: bool) -> bool:
    """Resolve a boolean setting from environment, config file, or default.

    Environment variables win because operators often use them for temporary
    overrides. The JSON config file remains useful for users who want durable
    settings without editing their shell profile.
    """
    raw_value = os.getenv(env_name)
    if raw_value is None:
        raw_value = config_data.get(key, default)

    if isinstance(raw_value, bool):
        return raw_value
    if isinstance(raw_value, str):
        return raw_value.strip().lower() not in ("0", "false", "no", "off")
    return bool(raw_value)


def _float_setting(config_data: dict, key: str, env_name: str, default: float) -> float:
    """Resolve a numeric setting from environment, config file, or default."""
    raw_value = os.getenv(env_name)
    if raw_value is None:
        raw_value = config_data.get(key, default)

    try:
        return float(raw_value)
    except (TypeError, ValueError):
        log_warning(f"Invalid numeric setting for {env_name}/{key}: {raw_value!r}; using {default}")
        return default


def _string_setting(config_data: dict, key: str, env_name: str, default: str) -> str:
    """Resolve a string setting from environment, config file, or default."""
    raw_value = os.getenv(env_name)
    if raw_value is None:
        raw_value = config_data.get(key, default)
    return str(raw_value)


def _ensure_api_key() -> str:
    """Ensure the agent has a Groq API key. Prompts interactively if missing.

    Checks environment variables and config file. If no key is found,
    prompts the user to enter one and saves it to the config file.
    """
    key = os.getenv("GROQ_API_KEY") or os.getenv("LOCALFLOW_API_KEY") or ""
    if key:
        return key

    cfg = _load_config_file()
    key = cfg.get("api_key", "")
    if key:
        return key

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

    cfg["api_key"] = key
    _save_config_file(cfg)
    print(f"\nAPI key saved to {CONFIG_FILE}")
    return key


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

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
