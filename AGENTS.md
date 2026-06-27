# Repo Notes

## Modular Conventions
We aim to keep the codebase modular and well-organized. When adding new features or making changes, please adhere to the following conventions:
- **Single Responsibility Principle**: Each module should have a single responsibility and should not be overloaded with unrelated functionality.
- **Separation of Concerns**: Keep related code together and unrelated code separate. This makes the codebase easier to navigate and maintain.
- **Consistent Naming**: Use consistent and descriptive names for modules, functions, and variables. This makes the codebase easier to understand and maintain.
- **LOC < ~ 400 per File**: Aim to keep individual files under 400 LOC to promote readability and maintainability. If a file exceeds this threshold, strongly favor refactoring it into smaller, more focused modules.

## Architecture (Current)

LocalFlow uses a **hosted API + BYOK desktop agent** model:

- **Web app**: `dictate.agentmemorylabs.com` (Next.js + Vercel) — landing page, setup guide, download, web dictation UI
- **Hosted API**: `/api/dictation/transcribe`, `/api/dictation/refine`, `/api/agent/query`
- **Desktop agent**: Python package (`agent/localflow_agent/`) that captures audio via global hotkeys and POSTs directly to the hosted API. Installed and managed by [uv](https://docs.astral.sh/uv/) as a tool — `uv tool install --editable .` provides the `localflow-agent` and `localflow-recover` console commands. No manual venv, no launcher-script generation.
- **BYOK**: Users bring their own Groq API key for transcription. The key is sent with each request and used by the hosted API to call Groq on the user's behalf. It is never stored server-side.

The local WebSocket service (`mini-services/websocket-service/`) and local Next.js server are **deprecated** for end-user operation. They are still useful for local development but not required for normal use.

## Agent Flow

1. Agent holds hotkey (e.g., `Alt+L`) → records audio via `sounddevice`
2. On release → encodes audio to base64 → POSTs to `https://dictate.agentmemorylabs.com/api/dictation/transcribe` with user's `apiKey`
3. Hosted API forwards audio to Groq Whisper using the provided key
4. If mode != "raw" → agent POSTs transcribed text to `/api/dictation/refine` (Cerebras, hosted by us)
5. Result pasted at cursor via `pyperclip` + `pyautogui`

## Hotkey Map (Current)

| Hotkey | Mode | Method |
|--------|------|--------|
| `Alt+L` | Raw dictation — transcription only, no LLM | Hold to record, release to paste |
| `Alt+M` | Outline/format dictation — Cerebras formats spoken structure | Hold to record, release to paste |
| `Alt+T` | Translation toggle — toggles Whisper translation mode on/off | Tap to toggle |
| `Alt+A` | Voice agent — asks a question, web search grounded answer pasted | Hold to record, release to paste |
| `Alt+J` | Format selected text — sends highlighted text to Cerebras formatter | Highlight first, then tap |
| `Alt+N` | Cleanup selected text — repairs Whisper artifacts in highlighted text | Highlight first, then tap |
| `Alt+.` / `Ctrl+.` | Toggle dictation — press once to start, press again to stop (raw dictation) | Tap to start, tap to stop |

All Alt hotkeys support left Alt, right Alt, and AltGr variants automatically.

## Hotkey Rules

- Keep dictation hotkeys in the `Alt+<letter>` space only.
- Letters `L`, `M`, `T`, `A`, `J`, `N` are all reserved. Do not assign new features to these without updating this table.
- The toggle dictation slot intentionally uses the **`.`** key (not a letter), so it cannot collide with any reserved Alt letter. Both `Alt+.` and `Ctrl+.` bind the same toggle behavior; either press starts/stops a toggle session. The two modes never interfere: starting a hold recording while a toggle session is active (and vice versa) is ignored.
- The selected-text formatter (`Alt+J`) and cleanup (`Alt+N`) must never reuse a letter already assigned to a recording or translation shortcut.
- For combo parsing, treat `ctrl+shift+j` style shortcuts as three tokens. The terminal key is the third token, not the second.

## Startup Verification

- If a hotkey change touches `agent/localflow-agent.py`, verify the agent starts cleanly before assuming the feature works.
- A startup crash in the desktop agent means `localflow-agent` can look "started" while `Alt+L` does nothing.
- Check for a log line like `Registering recording hotkeys:` and confirm the process stays alive after registration.
- The agent no longer requires a WebSocket connection. It should start immediately without waiting for a server.

## API Key Configuration (BYOK)

The agent looks for the Groq API key in this order:

1. `GROQ_API_KEY` environment variable
2. `LOCALFLOW_API_KEY` environment variable
3. `~/.localflow/config.json` (`api_key` field)
4. Interactive prompt on first run (saved to config file)

Config file format:
```json
{
  "api_key": "gsk_..."
}
```

The agent's default `api_url` is `https://dictate.agentmemorylabs.com`. Override with `LOCALFLOW_API_URL` env var.

## Clipboard Sentinel Pattern

The `copy_selection()` method (used by Alt+J and Alt+N) uses a sentinel to detect whether Ctrl+C actually captured the selection:

1. Save old clipboard content
2. Write `__WHISPR_COPY_SENTINEL__` to clipboard
3. Send Ctrl+C
4. Wait 200ms
5. Read clipboard — if still equals the sentinel, copy failed (wrong focus, nothing selected, Alt still held)
6. On failure: restore original clipboard, log warning, return empty string

This prevents stale clipboard content from being sent to the API when focus is wrong.

## Dictation Recovery (Failed + Successful)

The agent recovers dictations lost two distinct ways, surfaced together in one Recovery Console with **two tabs**:

- **Failed tab** — the transcription API itself failed. Audio is retained on disk, so a retry re-runs the API. Local-first: nothing is uploaded unless the user explicitly retries.
- **Successful tab** — the API succeeded, but the result was lost for a *non-API* reason (released the hotkey mid-sentence, paste missed the window, keyboard didn't register the hold, etc.). Only the returned **text** is retained, so recovery is a clipboard copy with **no API call**.

**Lifecycle**: A WAV candidate is written *before* transcription. On failure the sidecar is rewritten to `status: failed` and the WAV is retained until the failed-recording retention window expires. On success the WAV candidate is deleted immediately AND the returned text is saved to the history dir as a `.txt` + sidecar — audio is never kept for successful dictations.

**Failed artifacts** (in `~/.localflow/failed-recordings`):
- `localflow-failed-{YYYYMMDD-HHMMSS}-{epoch_millis}.wav` — 16kHz mono WAV
- Sibling `.json` sidecar with: `status` (`pending` → `failed` → `recovered`), `created_at`, `audio_file`, `mode`, `processing_mode`, `translate`, `retention_hours`, optional `error`, plus `recovery_command` and `retry_command` so recovery doesn't require remembering docs. The sidecar deliberately excludes the API key and request bodies.
- On successful retry, a sibling `.txt` transcript is written and the sidecar gains `recovered_at`, `recovered_text_file`, `retry_result`, `retried_at`, `agent_query_replayed`.

**Successful-history artifacts** (in `~/.localflow/history`, text only — never audio):
- `localflow-history-{YYYYMMDD-HHMMSS}-{epoch_millis}.txt` — the final (refined/formatted) text that was pasted.
- Sibling `.json` sidecar with: `status: success`, `created_at`, `text_file`, `mode`, `processing_mode`, `translate`, `chars`, `retention_hours`. No secrets.

**Config keys** (env, or the same names without the prefix in `~/.localflow/config.json`):
- Failed: `LOCALFLOW_SAVE_FAILED_RECORDINGS`, `LOCALFLOW_FAILED_RECORDINGS_DIR`, `LOCALFLOW_FAILED_RECORDINGS_RETENTION_HOURS`.
- History: `LOCALFLOW_SAVE_HISTORY` (default on), `LOCALFLOW_HISTORY_DIR`, `LOCALFLOW_HISTORY_RETENTION_HOURS` (default 72h).

**Recovery CLI flags** (in `main()`, branched before `agent.run()` like `--format-selection`):
- `--recover` — generate `recovery.html` (self-contained dark-theme dashboard with **Failed** and **Successful** tabs) and open it. `--no-open` skips the browser (headless/SSH). The Successful tab embeds each transcript with a "Copy text" button — no API call.
- `--list-failed-recordings` — print retained recordings newest-first with retry commands.
- `--list-history` — print saved successful transcripts newest-first with copy commands.
- `--retry-latest-failed` / `--retry-failed-recording <path>` — re-encode the WAV and run `process_audio_bytes` (a real API call). Default output is **clipboard copy** + `.txt` transcript; `--paste` pastes at cursor instead.
- `--replay-history <path>` — copy (or paste, with `--paste`) a saved successful transcript **without an API call**; the text is read straight from disk.
- `--retry-agent-query` — opt-in: for agent-mode (`Alt+A`) failed recordings, also replay the web-search voice-agent answer. **Off by default** — agent-mode retries transcribe only, because replaying a live web search is a different action than recovering speech.

**Shared pipeline**: `_stop_recording` and the retry path both call `LocalFlowAgent.process_audio_bytes(audio_bytes, mode, translate, run_agent_query=...)`. This helper does base64 → transcribe → (agent|refine|raw dispatch) and returns a structured dict. It never touches the overlay, paste handler, or failed-recording lifecycle, so callers compose it freely. If you change the transcribe/refine/agent dispatch logic, edit `process_audio_bytes` — both the live and retry paths pick up the change.

**Module split**: `recovery.py` owns the failed-audio lifecycle + retry; `history.py` owns successful-text history (save/enumerate/cleanup/replay); `recovery_console.py` renders the two-tab `recovery.html` dashboard plus the age-formatting helpers shared by the CLI listings.

**Failure overlay**: transcription failure shows `"Saved for recovery"` (blue `#24486b`), not an error — the audio is safely on disk. The detailed error goes to the log, and the path + `--recover` command are logged.

**Launchers**: `localflow-agent` and `localflow-recover` are uv-installed console scripts (`[project.scripts]` in the root `pyproject.toml` → `main` and `recover_main` entry points). The installers (`scripts/install-agent.{ps1,sh}`) clone the repo, bootstrap uv if needed, run `uv tool install --editable .`, and create Start Menu (Windows) / `.desktop` (Linux) shortcuts pointing at the console scripts. The old generated `.ps1`/`.cmd`/shell-launcher scripts and the `.venv-whispr` venv are obsolete under this model.

**Dev `whispr-flow` profile wrapper**: if you launch the dev stack via a `whispr-flow` function in your PowerShell `$PROFILE`, it must forward arguments with `@args` — otherwise flags like `-recover` are silently dropped. The correct form is `function whispr-flow { & "D:\whispr_flow_clones\opus\whispr-flow.ps1" @args }`. This is a machine-local entry (not in the repo), so if a flag works via direct invocation but not the bare command, check `$PROFILE` (e.g. `C:\Users\<user>\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`).

## Cerebras API Notes

- **Model in use**: `qwen-3-235b-a22b-instruct-2507` (free tier)
- `gpt-oss-120b` is NOT available on the free tier
- `reasoning_effort` parameter is only supported by `gpt-oss-120b` — do NOT include it with Qwen
- Three API keys are configured with automatic retry on 401/402/429: `CEREBRAS_API_KEY`, `CEREBRAS_API_KEY_2`, `CEREBRAS_API_KEY_3`

### TODO — Cerebras Tool Calling

Cerebras has published a "Build Your Own Perplexity" cookbook that suggests their API supports tool calling:
https://inference-docs.cerebras.ai/cookbook/agents/build-your-own-perplexity

The current voice agent (`Alt+A`) routes through Groq (`llama-3.3-70b-versatile`) for tool calling because Groq's tool use is well-tested. If Cerebras Qwen supports the full OpenAI tool calling spec (`tools`, `tool_choice`, `finish_reason: "tool_calls"`), switching the agent to Cerebras would be faster (~3,000 tok/s vs ~280 tok/s). Investigate and migrate if confirmed working.

## Voice Agent Architecture (Alt+A)

Flow:
1. Agent holds Alt+A → records audio
2. Agent POSTs audio to `/api/dictation/transcribe` (Groq Whisper via user's key)
3. Agent POSTs transcribed text to `/api/agent/query`
4. Route calls Groq `llama-3.3-70b-versatile` with `web_search` tool available
5. If model calls `web_search` → Brave Search API executes → results injected → model answers with grounding
6. Answer returned and pasted at cursor

Requires `BRAVE_API_KEY` in `.env` (hosted by us).

## Development Commands

- **Agent install/update (one-time + after dep changes):** `uv tool install --editable .` from the repo root. This is the canonical way to get the `localflow-agent` and `localflow-recover` console commands. The `--editable` flag means `git pull` updates the code without reinstalling (reinstall only after dependency changes).
- **Run the agent:** `localflow-agent` (no venv activation, no `cd agent`).
- **Run the recovery console:** `localflow-recover` (or `localflow-agent --recover`).
- `whispr-flow` — starts all dev services in background Windows Terminal tabs (Next.js + WS + agent). Calls the `localflow-agent` console command, falling back to `uv run --project <root> localflow-agent` for a fresh checkout. **Legacy local stack.**
- `whispr-flow-debug` — same services in the current terminal with color-coded logs. **Legacy local stack.**
- For hosted API development: `npm run dev` (Next.js dev server only).
- Agent stdout requires `-u` flag (unbuffered) when run as a Python subprocess directly — not needed when using the console command (uv's entry point handles it).

## Regression Notes (Historical)

- **2026-03-11**: Selected-text formatter regressed startup by registering `ctrl+shift+shift` instead of `ctrl+shift+j`, causing `pynput` to raise `ValueError: shift`. The hotkey listener never came up, making `Alt+L` appear broken.
- **2026-03-18**: Desktop agent needed a runtime settings fix so `Alt+M`, `Alt+N`, and `Alt+T` updates from the web UI actually refreshed the live hotkey listener state.
- **2026-03-20**: `pyautogui.press("escape")` added as a "fix" for clipboard capture, which caused `Alt+Escape` (minimize window) when Alt was still held. Removed. Replaced with clipboard sentinel pattern instead.
- **2026-04-20**: Refactored from local 3-service stack (agent + WebSocket + Next.js) to hosted API with BYOK. Agent now POSTs directly to `dictate.agentmemorylabs.com`. WebSocket dependency removed. First-run API key prompt added.
- **2026-06-14**: Packaged the agent as a uv-installable Python package (`agent/localflow_agent/` + root `pyproject.toml`). Replaced the clone+`pip install`+generated-launcher flow with `uv tool install --editable .`, which provides `localflow-agent` and `localflow-recover` console scripts. The old `.venv-whispr` venv and generated `.ps1`/`.cmd`/shell launchers are obsolete. Module renamed from `localflow-agent.py` (hyphen, not importable) to `localflow_agent/__init__.py`; the `recording_overlay` import became relative; `.env` loading now searches `LOCALFLOW_ENV_FILE` → `~/.localflow/.env` → cwd → repo-root (source checkout only) since `__file__`-relative paths break under `site-packages`.
