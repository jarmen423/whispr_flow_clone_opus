"""
Recovery Console renderer for the LocalFlow Desktop Agent.

Purpose & Reasoning:
    Renders the self-contained ``recovery.html`` dashboard that ``--recover``
    opens. It shows BOTH failure surfaces in one place so the user can recover
    from any kind of dictation loss:

      * **Failed** tab — recordings where the transcription API failed. Audio
        is retained, so a retry re-runs the API (``--retry-failed-recording``).
      * **Successful** tab — dictations where the API succeeded but the result
        was lost for a non-API reason (released the hotkey early, paste missed
        the window, keyboard didn't register, etc.). Only the *text* is kept,
        so recovery is a clipboard copy with NO API call.

    Splitting rendering out of ``recovery.py`` keeps that module focused on the
    failed-audio lifecycle + retry, while this module owns presentation. It is
    also the shared home for the age-formatting helpers used by the CLI
    listings.

Dependencies:
    - standard library only (json, html, time, os, pathlib). No network, no
      assets: the page is fully offline and embeds all CSS/JS inline.

Role in Codebase:
    Consumed by ``__init__.py`` for ``--recover``. Receives already-enumerated
    entry lists (from ``recovery._enumerate_failed_recordings`` and
    ``history._enumerate_history``) so filesystem reads stay in their modules.

Key Technologies/APIs:
    - html.escape: Safe interpolation of user text/filenames into the page.
    - json.dumps: Emits the per-entry transcript array as valid JS literals so
      the "Copy text" buttons never need server round-trips.
"""

import html as html_module
import json
import os
import time
from pathlib import Path


def _format_age(hours: float) -> str:
    """Human-readable age string used by the recovery HTML dashboard."""
    if hours < 1:
        return f"{int(hours * 60)}m ago"
    if hours < 24:
        return f"{hours:.1f}h ago"
    return f"{hours / 24:.1f}d ago"


def _format_age_short(hours: float) -> str:
    """Compact age string for the CLI listings."""
    if hours < 1:
        return f"{int(hours * 60)}m"
    if hours < 24:
        return f"{hours:.1f}h"
    return f"{hours / 24:.1f}d"


def _file_url(path: Path) -> str:
    """Build a clickable file:// URL from a path (cross-platform separators)."""
    return html_module.escape(str(path).replace(os.sep, "/"))


def _failed_row_html(e: dict) -> str:
    """Render one Failed-tab row (audio retained, retry re-runs the API)."""
    wav = e["path"]
    sidecar_path = wav.with_suffix(".json")
    transcript_path = wav.with_suffix(".txt")
    status = e["status"]
    mode = e["mode"] or "unknown"
    badge_class = "badge badge-recovered" if e["recovered"] else "badge badge-pending"
    retry_cmd = f'localflow-agent --retry-failed-recording "{wav}"'
    transcript_link = ""
    if transcript_path.exists():
        transcript_link = f'<a class="link" href="file:///{_file_url(transcript_path)}">transcript</a>'
    error_html = ""
    if e["error"]:
        error_html = f'<div class="error">Error: {html_module.escape(str(e["error"]))}</div>'
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
                <a class="link" href="file:///{_file_url(wav)}">audio</a>
                <a class="link" href="file:///{_file_url(sidecar_path)}">metadata</a>
                {transcript_link}
              </div>
              {"<!-- recovered -->" if e["recovered"] else f'<div class="cmd" title="Click to copy"><code>{html_module.escape(retry_cmd)}</code></div>'}
            </div>"""


def _preview(text: str, limit: int = 300) -> str:
    """Return a single-line preview of a transcript for the dashboard."""
    flat = " ".join(text.split())
    if len(flat) <= limit:
        return flat
    return flat[:limit - 1].rstrip() + "\u2026"


def _successful_row_html(e: dict, idx: int) -> str:
    """Render one Successful-tab row (text saved, copy needs no API call)."""
    txt = e["txt_path"]
    json_path = e["json_path"]
    mode = e["mode"] or "unknown"
    chars = e.get("chars", len(e.get("text", "")))
    preview = _preview(e.get("text", ""))
    preview_html = html_module.escape(preview) if preview else '<span class="muted">empty transcript</span>'
    return f"""
            <div class="row history-row">
              <div class="row-head">
                <span class="badge badge-success">SUCCESS</span>
                <span class="mode">{html_module.escape(mode)}</span>
                <span class="age">{html_module.escape(_format_age(e["age_hours"]))}</span>
                <span class="chars">{chars} chars</span>
                {("<span class='translated'>translated</span>") if e["translate"] else ""}
              </div>
              <div class="preview">{preview_html}</div>
              <div class="links">
                <button class="copybtn" data-idx="{idx}" title="Copy this text to the clipboard">Copy text</button>
                <a class="link" href="file:///{_file_url(txt)}">text file</a>
                <a class="link" href="file:///{_file_url(json_path)}">metadata</a>
              </div>
            </div>"""


def generate_recovery_console(
    failed_entries: list,
    history_entries: list,
    *,
    failed_dir: Path,
    history_dir: Path,
    retention_hours: float,
) -> Path:
    """Write a self-contained tabbed ``recovery.html`` dashboard.

    The page has two tabs: **Failed** (retry re-runs the API) and
    **Successful** (text is already saved — copy to clipboard, no API call).
    All CSS/JS is inlined; the only network action is a user-initiated CLI
    retry. Successful-tab transcripts are embedded as a JSON array so the
    "Copy text" buttons work fully offline.

    Args:
        failed_entries: Output of ``recovery._enumerate_failed_recordings``.
        history_entries: Output of ``history._enumerate_history``.
        failed_dir: Directory holding failed-audio artifacts (also the output
            location for ``recovery.html``).
        history_dir: Directory holding successful-text history artifacts.
        retention_hours: Retention window, shown as a stat on the dashboard.

    Returns:
        The Path to the written ``recovery.html``.
    """
    recoverable = [e for e in failed_entries if not e["recovered"]]
    recovered = [e for e in failed_entries if e["recovered"]]

    failed_rows = (
        "\n".join(_failed_row_html(e) for e in failed_entries)
        if failed_entries
        else '<p class="empty">No failed recordings. Audio is only kept when transcription fails.</p>'
    )
    history_rows = (
        "\n".join(_successful_row_html(e, i) for i, e in enumerate(history_entries))
        if history_entries
        else '<p class="empty">No successful transcripts in the retention window.</p>'
    )

    # Default-open the tab that has content, preferring Failed when both exist.
    default_tab = "failed" if (failed_entries or not history_entries) else "history"

    # Full transcripts embedded once as a JSON array -> valid JS string
    # literals. Buttons reference by index, so there are no per-row escaping
    # hazards and zero network round-trips to copy text.
    history_texts_js = json.dumps([e.get("text", "") for e in history_entries], ensure_ascii=False)

    failed_dir.mkdir(parents=True, exist_ok=True)
    html_path = failed_dir / "recovery.html"
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
  .privacy {{ background: var(--panel-2); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 6px; padding: 10px 14px; color: var(--muted); margin: 16px 0 16px; font-size: 13px; }}
  .tabs {{ display: flex; gap: 8px; margin-bottom: 16px; }}
  .tab {{ background: var(--panel); border: 1px solid var(--border); color: var(--muted); border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 14px; font-weight: 600; }}
  .tab.active {{ background: var(--panel-2); color: var(--text); border-color: var(--accent); }}
  .tab .count {{ font-size: 12px; opacity: .8; margin-left: 4px; }}
  .section {{ display: none; }}
  .section.active {{ display: block; }}
  .row {{ background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }}
  .recovered-row {{ opacity: .65; }}
  .row-head {{ display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }}
  .badge {{ font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; padding: 2px 8px; border-radius: 999px; }}
  .badge-pending {{ background: rgba(210,153,34,.15); color: var(--amber); }}
  .badge-recovered {{ background: rgba(63,185,80,.15); color: var(--green); }}
  .badge-success {{ background: rgba(91,157,255,.15); color: var(--accent); }}
  .mode {{ background: var(--panel-2); border: 1px solid var(--border); border-radius: 4px; padding: 1px 8px; font-size: 12px; color: var(--text); }}
  .age, .translated, .chars {{ color: var(--muted); font-size: 12px; }}
  .filename {{ font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 12px; color: var(--muted); word-break: break-all; margin-bottom: 6px; }}
  .preview {{ color: var(--text); font-size: 13px; margin-bottom: 6px; opacity: .9; }}
  .muted {{ color: var(--muted); font-style: italic; }}
  .error {{ color: var(--red); font-size: 13px; margin: 4px 0; }}
  .note {{ color: var(--muted); font-size: 12px; margin: 4px 0; }}
  .links {{ display: flex; gap: 14px; align-items: center; margin-top: 8px; }}
  .link {{ color: var(--accent); text-decoration: none; font-size: 13px; }}
  .link:hover {{ text-decoration: underline; }}
  .copybtn {{ background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 4px 12px; cursor: pointer; font-size: 13px; font-weight: 600; }}
  .copybtn:hover {{ border-color: var(--accent); }}
  .cmd {{ margin-top: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; cursor: pointer; }}
  .cmd code {{ font-family: ui-monospace, "SF Mono", Consolas, monospace; font-size: 12px; color: var(--text); word-break: break-all; }}
  .empty {{ color: var(--muted); }}
  footer {{ color: var(--muted); font-size: 12px; margin-top: 24px; }}
</style>
</head>
<body>
  <header>
    <h1>LocalFlow Recovery Console</h1>
    <div class="sub">Recover dictations from the last {retention_hours:g} hours. <b>Successful</b> entries need no API call &mdash; just copy the saved text.</div>
  </header>

  <div class="stats">
    <div class="stat"><div class="n">{len(recoverable)}</div><div class="l">Failed (retry)</div></div>
    <div class="stat"><div class="n">{len(recovered)}</div><div class="l">Recovered</div></div>
    <div class="stat"><div class="n">{len(history_entries)}</div><div class="l">Successful</div></div>
    <div class="stat"><div class="n">{retention_hours:g}h</div><div class="l">Retention</div></div>
  </div>

  <div class="privacy">
    Local-first. <b>Failed</b> tab: audio is kept so a retry re-runs your transcription endpoint. <b>Successful</b> tab: only the returned text is kept (no audio), so copy-to-clipboard never touches the API. Retry commands copy the shown <code>localflow-agent ...</code> line and run it yourself.
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="failed">Failed<span class="count">{len(failed_entries)}</span></div>
    <div class="tab" data-tab="history">Successful<span class="count">{len(history_entries)}</span></div>
  </div>

  <div class="section active" id="section-failed">
    {failed_rows}
  </div>

  <div class="section" id="section-history">
    {history_rows}
  </div>

  <footer>Generated {html_module.escape(now_str)} &middot; failed: {html_module.escape(str(failed_dir))} &middot; history: {html_module.escape(str(history_dir))}</footer>

  <script>
    var HISTORY_TEXTS = {history_texts_js};
    // Tab switching.
    document.querySelectorAll('.tab').forEach(function(t){{
      t.addEventListener('click', function(){{
        document.querySelectorAll('.tab').forEach(function(x){{ x.classList.remove('active'); }});
        document.querySelectorAll('.section').forEach(function(x){{ x.classList.remove('active'); }});
        t.classList.add('active');
        document.getElementById('section-' + t.getAttribute('data-tab')).classList.add('active');
      }});
    }});
    // Failed-tab retry commands: click to copy.
    document.querySelectorAll('.cmd').forEach(function(el){{
      el.addEventListener('click', function(){{
        navigator.clipboard.writeText(el.innerText.trim()).then(function(){{
          el.style.borderColor = '#3fb950';
          setTimeout(function(){{ el.style.borderColor = ''; }}, 800);
        }});
      }});
    }});
    // Successful-tab copy buttons: copy saved text, no API call.
    document.querySelectorAll('.copybtn').forEach(function(btn){{
      btn.addEventListener('click', function(){{
        var text = HISTORY_TEXTS[parseInt(btn.getAttribute('data-idx'), 10)] || '';
        navigator.clipboard.writeText(text).then(function(){{
          var original = btn.innerText;
          btn.innerText = 'Copied!';
          btn.style.borderColor = '#3fb950';
          setTimeout(function(){{ btn.innerText = original; btn.style.borderColor = ''; }}, 1000);
        }});
      }});
    }});
    // Open on the tab that actually has content.
    (function(){{
      var want = '{default_tab}';
      var failedCount = {len(failed_entries)};
      var histCount = {len(history_entries)};
      var target = want === 'history' && histCount > 0 ? 'history' : (failedCount > 0 || histCount === 0 ? 'failed' : 'history');
      if (target !== 'failed') {{
        document.querySelector('.tab[data-tab="' + target + '"]').click();
      }}
    }})();
  </script>
</body>
</html>
"""
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(document)
    return html_path
