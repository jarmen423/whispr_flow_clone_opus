# Repo Notes

## Architecture (Current)

LocalFlow uses a **hosted API + BYOK desktop agent** model:

- **Web app**: `dictate.agentmemorylabs.com` (Next.js + Vercel) — landing page, setup guide, download, web dictation UI
- **Hosted API**: `/api/dictation/transcribe`, `/api/dictation/refine`, `/api/agent/query`
- **Desktop agent**: Python script that captures audio via global hotkeys and POSTs directly to the hosted API
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

All Alt hotkeys support left Alt, right Alt, and AltGr variants automatically.

## Hotkey Rules

- Keep dictation hotkeys in the `Alt+<letter>` space only.
- Letters `L`, `M`, `T`, `A`, `J`, `N` are all reserved. Do not assign new features to these without updating this table.
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

- `whispr-flow` — starts all services in background (Windows Terminal tabs) — **legacy local stack**
- `whispr-flow-debug` — starts all services in current terminal with color-coded logs — **legacy local stack**
- For hosted API development: `npm run dev` (Next.js dev server only)
- Agent stdout requires `-u` flag (unbuffered) when run as a subprocess

## Regression Notes (Historical)

- **2026-03-11**: Selected-text formatter regressed startup by registering `ctrl+shift+shift` instead of `ctrl+shift+j`, causing `pynput` to raise `ValueError: shift`. The hotkey listener never came up, making `Alt+L` appear broken.
- **2026-03-18**: Desktop agent needed a runtime settings fix so `Alt+M`, `Alt+N`, and `Alt+T` updates from the web UI actually refreshed the live hotkey listener state.
- **2026-03-20**: `pyautogui.press("escape")` added as a "fix" for clipboard capture, which caused `Alt+Escape` (minimize window) when Alt was still held. Removed. Replaced with clipboard sentinel pattern instead.
- **2026-04-20**: Refactored from local 3-service stack (agent + WebSocket + Next.js) to hosted API with BYOK. Agent now POSTs directly to `dictate.agentmemorylabs.com`. WebSocket dependency removed. First-run API key prompt added.
