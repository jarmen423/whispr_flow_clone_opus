"""
Successful-transcription history for the LocalFlow Desktop Agent.

Purpose & Reasoning:
    The failed-recording subsystem (``recovery.py``) only keeps audio when the
    transcription API actually fails. In practice many dictation losses are
    NOT API failures: the user released the hotkey mid-sentence, the paste did
    not land in the right window, the keyboard did not register the hold, etc.
    In every one of those cases the API *succeeded* and returned valid text,
    but with the old design that text was pasted once and then discarded
    forever.

    This module retains the **returned text** of successful dictations (and
    only the text — never the audio) for a bounded window so the user can open
    the Recovery Console, find a recent successful entry, and copy the text
    straight to the clipboard WITHOUT making another API call. Re-grabbing
    saved text is the recovery mechanism for non-API failures.

Dependencies:
    - .config: log_info / log_warning helpers.
    - pyperclip: clipboard copy for the CLI replay path.
    - .recording.PasteHandler: type only, imported lazily for the paste path.

Role in Codebase:
    Called by ``__init__.py`` (the agent orchestrator) right after a successful
    transcription is pasted, and by the ``--recover`` / ``--list-history`` /
    ``--replay-history`` CLI branches. Sibling of ``recovery.py``: that module
    owns failed-audio lifecycle + retry; this module owns success-text history.

Key Technologies/APIs:
    - json: Sidecar metadata read/write (no secrets, no request bodies).
    - pathlib.Path: Cross-platform file operations.
    - pyperclip: Clipboard copy when replaying saved text.
"""

import json
import time
from pathlib import Path
from typing import Optional

from .config import log_info, log_warning

# File-name prefix for history artifacts. Each successful dictation produces a
# ``localflow-history-<timestamp>-<millis>.txt`` (the text) and a sibling
# ``.json`` sidecar (metadata). The distinct prefix keeps glob patterns from
# colliding with the ``localflow-failed-*`` audio artifacts in recovery.py.
_HISTORY_PREFIX = "localflow-history-"


def _unlink_if_exists(path: Path) -> None:
    """Remove a file if present (kept Python 3.7-friendly)."""
    if path.exists():
        path.unlink()


def _save_successful_history(
    text: str,
    effective_mode: str,
    processing_mode: str,
    translate: bool,
    save_history: bool,
    history_dir: Path,
    retention_hours: float,
) -> Optional[Path]:
    """Persist the final transcript of a successful dictation (text only).

    Writes a ``.txt`` transcript plus a ``.json`` sidecar so the Recovery
    Console can show mode/age/length and offer a copy without re-running the
    API. The WAV candidate for failed-recovery is discarded separately by the
    orchestrator; this function never touches audio.

    Args:
        text: The final (refined/formatted) text that was pasted.
        effective_mode: Active dictation mode ("raw", "outline", "agent", ...).
        processing_mode: Where processing ran ("cloud", "networked-local", ...).
        translate: Whether translation mode was active for this dictation.
        save_history: Master toggle (LOCALFLOW_SAVE_HISTORY).
        history_dir: Directory to write history artifacts into.
        retention_hours: Cleanup window; also recorded in the sidecar.

    Returns:
        The Path to the written ``.txt`` transcript, or None if history is
        disabled, the text was empty, or the write failed (logged as warning).
    """
    if not save_history or not text:
        return None

    try:
        _cleanup_history(history_dir, retention_hours)
        history_dir.mkdir(parents=True, exist_ok=True)

        timestamp = time.strftime("%Y%m%d-%H%M%S")
        base = history_dir / f"{_HISTORY_PREFIX}{timestamp}-{int(time.time() * 1000)}"
        txt_path = base.with_suffix(".txt")
        json_path = base.with_suffix(".json")

        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)

        sidecar = {
            "status": "success",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "text_file": txt_path.name,
            "mode": effective_mode,
            "processing_mode": processing_mode,
            "translate": translate,
            "chars": len(text),
            "retention_hours": retention_hours,
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(sidecar, f, indent=2)

        return txt_path
    except Exception as e:
        log_warning(f"Could not save successful-transcription history: {e}")
        return None


def _cleanup_history(history_dir: Path, retention_hours: float) -> None:
    """Delete expired successful-history artifacts.

    Uses file modification time so cleanup also reclaims space left by a
    crashed agent process. Orphaned sidecars (missing their ``.txt``) are
    swept up too.
    """
    if not history_dir.exists():
        return

    retention_seconds = retention_hours * 3600
    now = time.time()

    for txt_path in history_dir.glob(f"{_HISTORY_PREFIX}*.txt"):
        try:
            if now - txt_path.stat().st_mtime <= retention_seconds:
                continue
            _unlink_if_exists(txt_path)
            _unlink_if_exists(txt_path.with_suffix(".json"))
            log_info(f"Deleted expired history entry: {txt_path.name}")
        except Exception as e:
            log_warning(f"Failed to clean up history entry {txt_path}: {e}")

    for json_path in history_dir.glob(f"{_HISTORY_PREFIX}*.json"):
        try:
            if json_path.with_suffix(".txt").exists():
                continue
            if now - json_path.stat().st_mtime > retention_seconds:
                _unlink_if_exists(json_path)
        except Exception as e:
            log_warning(f"Failed to clean up history metadata {json_path}: {e}")


def _enumerate_history(history_dir: Path) -> list:
    """List successful-history entries newest-first.

    Returns a list of dicts with keys: ``txt_path`` (Path), ``json_path``
    (Path), ``mtime`` (float), ``age_hours`` (float), ``text`` (str),
    ``mode`` (str), ``translate`` (bool), ``chars`` (int). Corrupt or missing
    sidecars do not raise; the entry is returned with metadata defaults so the
    transcript is still surfaced.
    """
    if not history_dir.exists():
        return []

    entries: list = []
    now = time.time()
    for txt_path in history_dir.glob(f"{_HISTORY_PREFIX}*.txt"):
        try:
            mtime = txt_path.stat().st_mtime
        except OSError as e:
            log_warning(f"Failed to stat history entry {txt_path}: {e}")
            continue

        json_path = txt_path.with_suffix(".json")
        sidecar: dict = {}
        if json_path.exists():
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    sidecar = json.load(f)
            except (OSError, ValueError) as e:
                log_warning(f"Could not read history sidecar {json_path}: {e}")

        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                text = f.read()
        except OSError as e:
            log_warning(f"Could not read history transcript {txt_path}: {e}")
            text = ""

        entries.append(
            {
                "txt_path": txt_path,
                "json_path": json_path,
                "mtime": mtime,
                "age_hours": max(0.0, (now - mtime) / 3600.0),
                "text": text,
                "mode": sidecar.get("mode", "unknown"),
                "translate": bool(sidecar.get("translate", False)),
                "chars": sidecar.get("chars", len(text)),
            }
        )

    entries.sort(key=lambda e: e["mtime"], reverse=True)
    return entries


def _replay_history(txt_path: Path, paste: bool, paste_handler) -> dict:
    """Copy a saved successful-transcription transcript (no API call).

    Reads the stored ``.txt`` and either copies it to the clipboard (default)
    or pastes it at the cursor. This is the recovery mechanism for successful
    dictations: because the text already exists on disk there is never a need
    to re-run the transcription/refine pipeline.

    Args:
        txt_path: Path to the ``localflow-history-*.txt`` transcript file.
        paste: If True, paste at the cursor via ``paste_handler``; otherwise
            copy to the clipboard.
        paste_handler: PasteHandler instance (only used when ``paste`` is True).

    Returns:
        Dict with ``success`` (bool), ``text`` (str), ``txt_path`` (Path),
        and ``error`` (str) on failure.
    """
    import pyperclip

    txt_path = Path(txt_path).expanduser()
    if not txt_path.exists():
        return {"success": False, "error": f"History text not found: {txt_path}", "txt_path": txt_path}

    try:
        with open(txt_path, "r", encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        return {"success": False, "error": f"Could not read history text: {e}", "txt_path": txt_path}

    if not text:
        return {"success": False, "error": "History text is empty", "txt_path": txt_path}

    if paste:
        paste_handler.paste_text(text)
    else:
        try:
            pyperclip.copy(text)
        except Exception as e:
            log_warning(f"Could not copy history text to clipboard: {e}")

    return {"success": True, "text": text, "txt_path": txt_path, "pasted": bool(paste)}
