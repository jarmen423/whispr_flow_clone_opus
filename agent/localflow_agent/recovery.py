"""
Failed-recording recovery subsystem for the LocalFlow Desktop Agent.

Purpose & Reasoning:
    When transcription fails, the agent retains the WAV file on disk so the
    user can recover their speech. This module provides the complete lifecycle:
    writing a candidate before transcription, marking it as failed on error,
    enumerating recordings, retrying them, generating a self-contained HTML
    recovery dashboard, and cleaning up expired files.

Dependencies:
    - .config: CONFIG, log_* helpers.
    - .api: process_audio_bytes (shared pipeline).
    - .recording: PasteHandler is imported only for type annotation (it's
      used by the retry path to paste recovered text).

Role in Codebase:
    Used by __init__.py (the agent orchestrator) which delegates all recovery
    operations to methods in this module. Depends on config.py, api.py, and
    recording.py.

Key Technologies/APIs:
    - json: Sidecar file read/write for recovery metadata.
    - pathlib.Path: Cross-platform file operations.
    - pyperclip: Clipboard copy for recovered text.
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import pyperclip

from .config import (
    CONFIG,
    CONFIG_DIR,
    CONFIG_FILE,
    _ensure_api_key,
    _load_config_file,
    _save_config_file,
    _bool_setting,
    _float_setting,
    _string_setting,
    log,
    log_info,
    log_error,
    log_warning,
)


def _format_age(hours: float) -> str:
    """Human-readable age string used by the recovery HTML dashboard."""
    if hours < 1:
        return f"{int(hours * 60)}m ago"
    if hours < 24:
        return f"{hours:.1f}h ago"
    return f"{hours / 24:.1f}d ago"


def _format_age_short(hours: float) -> str:
    """Compact age string for the failed-recordings CLI listing."""
    if hours < 1:
        return f"{int(hours * 60)}m"
    if hours < 24:
        return f"{hours:.1f}h"
    return f"{hours / 24:.1f}d"


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


def _generate_recovery_html(failed_recordings_dir: Path, retention_hours: float) -> Path:
    """Write a self-contained ``recovery.html`` dashboard into the recovery dir.

    The page lists every retained recording with status, mode, age, error
    summary, file:// links to the WAV/sidecar/transcript, and a copyable
    retry command. It uses inlined CSS only: no external assets, no web
    server, no tracking.
    """
    import html as html_module

    entries = _enumerate_failed_recordings(failed_recordings_dir)
    recoverable = [e for e in entries if not e["recovered"]]
    recovered = [e for e in entries if e["recovered"]]

    def _row_html(e: dict) -> str:
        wav = e["path"]
        sidecar_path = wav.with_suffix(".json")
        transcript_path = wav.with_suffix(".txt")
        status = e["status"]
        mode = e["mode"] or "unknown"
        badge_class = "badge badge-recovered" if e["recovered"] else "badge badge-pending"
        retry_cmd = f'localflow-agent --retry-failed-recording "{wav}"'
        transcript_link = ""
        if transcript_path.exists():
            transcript_link = (
                f'<a class="link" href="file:///{html_module.escape(str(transcript_path).replace(os.sep, "/"))}">transcript</a>'
            )
        error_html = ""
        if e["error"]:
            error_html = (
                f'<div class="error">Error: {html_module.escape(str(e["error"]))}</div>'
            )
        agent_note = ""
        if mode == "agent" and not e["recovered"]:
            agent_note = '<div class="note">Agent mode retries transcribe only by default. Add --retry-agent-query to replay the web-search answer.</div>'
        return f"""
            <div class="row {"recovered-row" if e["recovered"] else ""}">
              <div class="row-head">
                <span class="{badge_class}">{html_module.escape(status)}</span>
                <span class="mode">{html_module.escape(mode)}</span>
                <span class="age">{html_module.escape(_format_age(e["age_hours"]))}</span>
                {("<span class='translated'>translated</span>") if e["translate"] else ""}
              </div>
              <div class="filename">{html_module.escape(wav.name)}</div>
              {error_html}
              {agent_note}
              <div class="links">
                <a class="link" href="file:///{html_module.escape(str(wav).replace(os.sep, "/"))}">audio</a>
                <a class="link" href="file:///{html_module.escape(str(sidecar_path).replace(os.sep, "/"))}">metadata</a>
                {transcript_link}
              </div>
              {"<!-- recovered -->" if e["recovered"] else f'<div class="cmd" title="Click to copy"><code>{html_module.escape(retry_cmd)}</code></div>'}
            </div>"""

    rows_html = "\n".join(_row_html(e) for e in entries) if entries else '<p class="empty">No retained recordings. Saved audio is discarded automatically once transcription succeeds.</p>'

    recovery_dir = failed_recordings_dir
    html_path = recovery_dir / "recovery.html"
    recovery_dir.mkdir(parents=True, exist_ok=True)

    now_str = time.strftime("%Y-%m-%d %H:%M:%S")
    document = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LocalFlow Recovery Console</title>
<style>
  :root {{
    --bg: #0f1117; --panel: #1a1d27; --panel-2: #222634; --text: #e6e8ef;
    --muted: #9aa0b4; --accent: #5b9dff; --green: #3fb950; --amber: #d29922;
    --red: #f85149; --border: #2c3142;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 24px clamp(16px, 5vw, 48px);
  }}
  header h1 {{ margin: 0 0 4px; font-size: 22px; }}
  header .sub {{ color: var(--muted); margin-bottom: 16px; }}
  .stats {{ display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }}
  .stat {{ background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; min-width: 120px; }}
  .stat .n {{ font-size: 22px; font-weight: 600; }}
  .stat .l {{ color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }}
  .privacy {{ background: var(--panel-2); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 6px; padding: 10px 14px; color: var(--muted); margin: 16px 0 24px; font-size: 13px; }}
  .row {{ background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }}
  .recovered-row {{ opacity: .65; }}
  .row-head {{ display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }}
  .badge {{ font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 999px; }}
  .badge-pending {{ background: rgba(210,153,34,.15); color: var(--amber); }}
  .badge-recovered {{ background: rgba(63,185,80,.15); color: var(--green); }}
  .mode {{ background: var(--panel-2); border: 1px solid var(--border); border-radius: 4px; padding: 1px 8px; font-size: 12px; color: var(--text); }}
  .age, .translated {{ color: var(--muted); font-size: 12px; }}
  .filename {{ font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 12px; color: var(--muted); word-break: break-all; margin-bottom: 6px; }}
  .error {{ color: var(--red); font-size: 13px; margin: 4px 0; }}
  .note {{ color: var(--muted); font-size: 12px; margin: 4px 0; }}
  .links {{ display: flex; gap: 14px; margin-top: 8px; }}
  .link {{ color: var(--accent); text-decoration: none; font-size: 13px; }}
  .link:hover {{ text-decoration: underline; }}
  .cmd {{ margin-top: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; cursor: pointer; }}
  .cmd code {{ font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 12px; color: var(--text); word-break: break-all; }}
  .empty {{ color: var(--muted); }}
  footer {{ color: var(--muted); font-size: 12px; margin-top: 24px; }}
</style>
</head>
<body>
  <header>
    <h1>LocalFlow Recovery Console</h1>
    <div class="sub">Saved dictation audio lives here until it is recovered or the retention window expires.</div>
  </header>

  <div class="stats">
    <div class="stat"><div class="n">{len(recoverable)}</div><div class="l">Recoverable</div></div>
    <div class="stat"><div class="n">{len(recovered)}</div><div class="l">Recovered</div></div>
    <div class="stat"><div class="n">{retention_hours:g}h</div><div class="l">Retention</div></div>
  </div>

  <div class="privacy">
    Local-first: audio stays on your disk. Running a retry command uploads only that single file to your configured transcription endpoint. Nothing here is sent anywhere until you choose to retry.
  </div>

  {rows_html}

  <footer>Generated {html_module.escape(now_str)} &middot; {html_module.escape(str(recovery_dir))}</footer>

  <script>
    document.querySelectorAll('.cmd').forEach(function(el){{
      el.addEventListener('click', function(){{
        var text = el.innerText.trim();
        navigator.clipboard.writeText(text).then(function(){{
          el.style.borderColor = '#3fb950';
          setTimeout(function(){{ el.style.borderColor = ''; }}, 800);
        }});
      }});
    }});
  </script>
</body>
</html>
"""
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(document)
    return html_path
