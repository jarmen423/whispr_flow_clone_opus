"""
Failed-recording recovery subsystem for the LocalFlow Desktop Agent.

Purpose & Reasoning:
    When transcription fails, the agent retains the WAV file on disk so the
    user can recover their speech. This module provides the audio-side
    lifecycle: writing a candidate before transcription, marking it as failed
    on error, enumerating recordings, and retrying them through the shared
    transcription pipeline. Expired-file cleanup is also here.

    Rendering of the Recovery Console (the ``recovery.html`` dashboard) and
    successful-transcript history live in sibling modules:
    ``recovery_console.py`` (presentation) and ``history.py`` (saved text for
    non-API failures). This split keeps each concern focused.

Dependencies:
    - .config: CONFIG, log_* helpers.
    - .api: process_audio_bytes (shared pipeline, imported lazily in retry).
    - .recording: PasteHandler is imported only for type annotation (used by
      the retry path to paste recovered text).

Role in Codebase:
    Used by __init__.py (the agent orchestrator) which delegates failed-audio
    recovery operations to methods in this module.

Key Technologies/APIs:
    - json: Sidecar file read/write for recovery metadata.
    - pathlib.Path: Cross-platform file operations.
    - pyperclip: Clipboard copy for recovered text.
"""

import json
import time
from pathlib import Path
from typing import Optional

import pyperclip

from .config import (
    log_info,
    log_warning,
)


# ---------------------------------------------------------------------------
# Failed-recording lifecycle (called by the agent orchestrator)
# ---------------------------------------------------------------------------

def _write_failed_recording_metadata(
    recording_path: Path,
    status: str,
    effective_mode: str,
    processing_mode: str,
    translate: bool,
    retention_hours: float,
    error: Optional[str] = None,
) -> None:
    """Write the recovery sidecar for a retained recording.

    The sidecar avoids storing secrets or request bodies. It exists to make
    manual recovery easy: users can see when the recording happened, what
    mode was active, and why the agent kept the WAV file. It also records
    the exact CLI commands to recover so users and future agents don't need
    to remember the docs.
    """
    metadata = {
        "status": status,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "audio_file": recording_path.name,
        "mode": effective_mode,
        "processing_mode": processing_mode,
        "translate": translate,
        "retention_hours": retention_hours,
        "recovery_command": "localflow-agent --recover",
        "retry_command": f'localflow-agent --retry-failed-recording "{recording_path}"',
    }
    if error:
        metadata["error"] = error

    with open(recording_path.with_suffix(".json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


def _save_failed_recording_candidate(
    audio_bytes: bytes,
    effective_mode: str,
    processing_mode: str,
    translate: bool,
    save_failed_recordings: bool,
    failed_recordings_dir: Path,
    retention_hours: float,
) -> Optional[Path]:
    """Persist a recoverable WAV before transcription can fail.

    The file is called a candidate because successful transcription deletes
    it immediately. Only files still present after an error are user-facing
    recovery artifacts.
    """
    if not save_failed_recordings:
        return None

    try:
        _cleanup_failed_recordings(failed_recordings_dir, retention_hours)
        failed_recordings_dir.mkdir(parents=True, exist_ok=True)

        timestamp = time.strftime("%Y%m%d-%H%M%S")
        recording_path = failed_recordings_dir / f"localflow-failed-{timestamp}-{int(time.time() * 1000)}.wav"
        with open(recording_path, "wb") as f:
            f.write(audio_bytes)

        _write_failed_recording_metadata(
            recording_path, "pending", effective_mode, processing_mode, translate, retention_hours
        )
        return recording_path
    except Exception as e:
        log_warning(f"Failed-recording safeguard could not save audio: {e}")
        return None


def _retain_failed_recording(
    recording_path: Optional[Path],
    effective_mode: str,
    processing_mode: str,
    translate: bool,
    retention_hours: float,
    error: str,
) -> None:
    """Mark a candidate recording as retained after transcription fails."""
    if not recording_path:
        return

    try:
        _write_failed_recording_metadata(
            recording_path, "failed", effective_mode, processing_mode, translate, retention_hours, error
        )
        log_warning(f"Failed recording saved for recovery: {recording_path}")
    except Exception as e:
        log_warning(f"Failed to update recovery metadata for {recording_path}: {e}")


def _discard_failed_recording_candidate(recording_path: Optional[Path]) -> None:
    """Delete the temporary recovery candidate after transcription succeeds."""
    if not recording_path:
        return

    try:
        _unlink_if_exists(recording_path)
        _unlink_if_exists(recording_path.with_suffix(".json"))
    except Exception as e:
        log_warning(f"Failed to discard successful recording recovery file {recording_path}: {e}")


def _unlink_if_exists(path: Path) -> None:
    """Remove a file if present while preserving Python 3.7 support."""
    if path.exists():
        path.unlink()


def _cleanup_failed_recordings(failed_recordings_dir: Path, retention_hours: float) -> None:
    """Delete expired failed-recording recovery files.

    Failed recordings intentionally live on disk for a bounded window so a
    user can recover speech after a transcription outage. Cleanup uses file
    modification time so it also works for files left behind by a crashed
    agent process.
    """
    if not failed_recordings_dir.exists():
        return

    retention_seconds = retention_hours * 3600
    now = time.time()

    for path in failed_recordings_dir.glob("localflow-failed-*.wav"):
        try:
            if now - path.stat().st_mtime <= retention_seconds:
                continue

            sidecar_path = path.with_suffix(".json")
            _unlink_if_exists(path)
            _unlink_if_exists(sidecar_path)
            log_info(f"Deleted expired failed recording: {path}")
        except Exception as e:
            log_warning(f"Failed to clean up failed recording {path}: {e}")

    for sidecar_path in failed_recordings_dir.glob("localflow-failed-*.json"):
        try:
            if sidecar_path.with_suffix(".wav").exists():
                continue
            if now - sidecar_path.stat().st_mtime > retention_seconds:
                _unlink_if_exists(sidecar_path)
        except Exception as e:
            log_warning(f"Failed to clean up failed recording metadata {sidecar_path}: {e}")


# ---------------------------------------------------------------------------
# Enumeration and retry
# ---------------------------------------------------------------------------

def _enumerate_failed_recordings(failed_recordings_dir: Path) -> list:
    """List retained failed recordings newest-first.

    Each entry is a dict with keys: ``path`` (Path), ``sidecar`` (dict or
    None), ``mtime`` (float), ``age_hours`` (float), ``recovered`` (bool),
    ``mode``, ``translate``, ``status``, ``error``. Corrupt or missing
    sidecars do not raise: the entry is returned with ``sidecar=None`` so
    the WAV is still surfaced for manual retry.
    """
    if not failed_recordings_dir.exists():
        return []

    entries: list = []
    now = time.time()
    for path in failed_recordings_dir.glob("localflow-failed-*.wav"):
        try:
            mtime = path.stat().st_mtime
        except OSError as e:
            log_warning(f"Failed to stat failed recording {path}: {e}")
            continue

        sidecar_path = path.with_suffix(".json")
        sidecar = None
        if sidecar_path.exists():
            try:
                with open(sidecar_path, "r", encoding="utf-8") as f:
                    sidecar = json.load(f)
            except (OSError, ValueError) as e:
                log_warning(f"Could not read sidecar {sidecar_path}: {e}")

        status = (sidecar or {}).get("status", "failed")
        entries.append(
            {
                "path": path,
                "sidecar": sidecar,
                "mtime": mtime,
                "age_hours": max(0.0, (now - mtime) / 3600.0),
                "recovered": status == "recovered",
                "mode": (sidecar or {}).get("mode", "unknown"),
                "translate": bool((sidecar or {}).get("translate", False)),
                "status": status,
                "error": (sidecar or {}).get("error"),
            }
        )

    entries.sort(key=lambda e: e["mtime"], reverse=True)
    return entries


def _read_sidecar(wav_path: Path) -> dict:
    """Read the JSON sidecar for a WAV path, raising FileNotFoundError if absent."""
    sidecar_path = wav_path.with_suffix(".json")
    if not sidecar_path.exists():
        raise FileNotFoundError(f"No sidecar JSON next to {wav_path.name}")
    with open(sidecar_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _record_retry_outcome(
    wav_path: Path,
    sidecar: dict,
    success: bool,
    error: Optional[str] = None,
    transcript_path: Optional[Path] = None,
    replayed_agent: bool = False,
) -> None:
    """Update the sidecar in place with the outcome of a retry attempt."""
    sidecar.update(
        {
            "retry_result": "recovered" if success else "failed",
            "retried_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "agent_query_replayed": replayed_agent,
        }
    )
    if success:
        sidecar["status"] = "recovered"
        if transcript_path is not None:
            sidecar["recovered_text_file"] = transcript_path.name
    if error:
        sidecar["retry_error"] = error

    try:
        with open(wav_path.with_suffix(".json"), "w", encoding="utf-8") as f:
            json.dump(sidecar, f, indent=2)
    except OSError as e:
        log_warning(f"Could not update sidecar after retry: {e}")


def _retry_failed_recording(
    wav_path: Path,
    paste: bool,
    replay_agent: bool,
    api_key: str,
    processing_mode: str,
    paste_handler,  # PasteHandler instance
) -> dict:
    """Retry transcription (and optional refinement) for a retained WAV.

    Reads the sidecar for the original ``mode``/``translate``, re-encodes
    the WAV, and runs the shared ``process_audio_bytes`` pipeline. On
    success the recovered text is copied to the clipboard (or pasted with
    ``paste=True``), saved as a sibling ``.txt`` transcript, and the
    sidecar is marked ``recovered``. On failure the WAV is retained and
    the sidecar records the retry error.

    Returns a dict with ``success``, ``text``, ``error``, ``wav_path``.
    """
    from .api import process_audio_bytes

    wav_path = Path(wav_path).expanduser()
    if not wav_path.exists():
        return {"success": False, "error": f"Recording not found: {wav_path}", "wav_path": wav_path}

    try:
        sidecar = _read_sidecar(wav_path)
    except (FileNotFoundError, ValueError) as e:
        return {"success": False, "error": str(e), "wav_path": wav_path}

    mode = sidecar.get("mode", "raw")
    translate = bool(sidecar.get("translate", False))

    run_agent_query = bool(replay_agent) and mode == "agent"

    try:
        with open(wav_path, "rb") as f:
            audio_bytes = f.read()
    except OSError as e:
        return {"success": False, "error": f"Could not read audio file: {e}", "wav_path": wav_path}

    result = process_audio_bytes(audio_bytes, mode, translate, api_key, processing_mode, run_agent_query=run_agent_query)

    if not result["success"]:
        _record_retry_outcome(wav_path, sidecar, success=False, error=result.get("error"))
        return {"success": False, "error": result.get("error"), "wav_path": wav_path}

    final_text = result["text"]

    transcript_path = wav_path.with_suffix(".txt")
    try:
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(final_text)
    except OSError as e:
        log_warning(f"Could not write recovered transcript {transcript_path}: {e}")

    if paste:
        paste_handler.paste_text(final_text)
    else:
        try:
            pyperclip.copy(final_text)
        except Exception as e:
            log_warning(f"Could not copy recovered text to clipboard: {e}")

    _record_retry_outcome(
        wav_path,
        sidecar,
        success=True,
        transcript_path=transcript_path,
        replayed_agent=run_agent_query,
    )

    return {
        "success": True,
        "text": final_text,
        "raw_text": result.get("raw_text", ""),
        "wav_path": wav_path,
        "transcript_path": transcript_path,
        "agent_query_replayed": run_agent_query,
    }


def _retry_latest_failed(
    failed_recordings_dir: Path,
    paste: bool,
    replay_agent: bool,
    api_key: str,
    processing_mode: str,
    paste_handler,
) -> dict:
    """Retry the newest not-yet-recovered failed recording.

    Returns the ``_retry_failed_recording`` result, or a failure dict with
    ``error="no recordings"`` when nothing is eligible.
    """
    for entry in _enumerate_failed_recordings(failed_recordings_dir):
        if entry["recovered"]:
            continue
        return _retry_failed_recording(
            entry["path"], paste=paste, replay_agent=replay_agent,
            api_key=api_key, processing_mode=processing_mode, paste_handler=paste_handler,
        )
    return {"success": False, "error": "No unrecovered failed recordings to retry"}
