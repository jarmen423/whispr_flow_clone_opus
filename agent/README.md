# LocalFlow Desktop Agent

The LocalFlow desktop agent enables system-wide dictation with a global hotkey. Press and hold the hotkey to record, release to transcribe and paste.

## Quick Start

The agent is a Python package installed and managed by [uv](https://docs.astral.sh/uv/). From the repo root:

### 1. Install (editable, picks up `git pull` automatically)

```bash
uv tool install --editable .
```

This creates two console commands on your PATH: `localflow-agent` (the agent) and `localflow-recover` (the recovery console). No manual venv, no `pip install`.

### 2. Run the Agent

```bash
localflow-agent
```

### 3. Use

**Five hotkey workflows are available:**

| Hotkey | Mode | Description |
|--------|------|-------------|
| `Alt+L` | Raw | Fast transcription without post-processing |
| `Alt+M` | Format | Transcription with Cerebras LLM formatting (lists, outlines, indentation) |
| `Alt+T` | Toggle | Toggle translation mode (🌐 speak any language → English) |
| `Alt+J` | Selection Format | Format highlighted text without recording audio |
| `Alt+N` | Selection Cleanup | Clean highlighted text for punctuation, spelling, and grammar |

1. Press and hold your chosen recording hotkey (`Alt+L` or `Alt+M`)
2. Speak clearly (include voice commands like "bullet", "new line" in format mode)
3. Release the keys
4. Text is automatically pasted at your cursor

**Translation Mode:**
Press `Alt+T` to toggle translation on/off. When enabled, speak in any language and get English output.

**Selection Formatter:**
Highlight text and press `Alt+J` to reformat the current selection without using the microphone.

## Configuration

Set these environment variables:

| Variable                   | Default                    | Description                                                                |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `LOCALFLOW_WS_URL`         | `http://localhost:3002`     | WebSocket server URL                                                       |
| `LOCALFLOW_HOTKEY`         | `alt+l`                    | Global hotkey for raw mode                                                 |
| `LOCALFLOW_FORMAT_HOTKEY`  | `alt+m`                    | Hotkey for format mode (uses Cerebras LLM for outlines/lists)              |
| `LOCALFLOW_CLEANUP_HOTKEY` | `alt+n`                    | Hotkey to clean highlighted text (fix punctuation words, spelling, grammar) |
| `LOCALFLOW_TRANSLATE_HOTKEY` | `alt+t`                  | Hotkey to toggle translation mode                                          |
| `LOCALFLOW_SELECTION_FORMAT_HOTKEY` | `alt+j`          | Hotkey to format highlighted text without recording                        |
| `LOCALFLOW_TRANSLATE`      | `false`                    | Default translation mode (true/false)                                      |
| `LOCALFLOW_MODE`           | `developer`                | Refinement mode (developer, concise, professional, raw, outline, cleanup)  |
| `LOCALFLOW_PROCESSING`     | `cloud`                    | Processing mode (cloud, networked-local, local)                            |
| `LOCALFLOW_SAVE_FAILED_RECORDINGS` | `true`             | Save recoverable WAV files when transcription fails before text is returned |
| `LOCALFLOW_FAILED_RECORDINGS_DIR` | `~/.localflow/failed-recordings` | Directory for failed recording WAV files and metadata sidecars |
| `LOCALFLOW_FAILED_RECORDINGS_RETENTION_HOURS` | `72`      | Hours to keep failed recording files before automatic cleanup               |
| `DEBUG`                    | -                          | Set to any value for debug logging                                         |
| `CEREBRAS_API_KEY`         | -                          | Required for format mode (get from https://cloud.cerebras.ai/)             |

### Failed Recording Recovery

The agent saves a local recovery copy of each recording before sending it to the transcription API. If transcription succeeds, that temporary copy is deleted immediately. If transcription fails, the WAV remains on disk with a `.json` sidecar that records the active mode, processing backend, translation flag, retention window, failure message, and the exact CLI commands to recover it.

On failure the overlay shows **"Saved for recovery"** (blue) instead of an error, and the agent logs the saved WAV path plus `localflow-agent --recover` as the next step.

Default recovery directory:

```text
~/.localflow/failed-recordings
```

The recovery files are deleted automatically after `LOCALFLOW_FAILED_RECORDINGS_RETENTION_HOURS` hours. Set `LOCALFLOW_SAVE_FAILED_RECORDINGS=false` to disable the safeguard.

#### The Recovery Console

`localflow-agent --recover` generates a self-contained `recovery.html` dashboard inside the recovery directory and opens it in your default browser. The page lists every retained recording with its status (pending/recovered), mode, age, error summary, `file://` links to the audio/metadata/transcript, and a click-to-copy retry command. It uses inlined CSS only — no external assets, no web server, no tracking.

```bash
localflow-agent --recover        # generate and open the console
localflow-agent --recover --no-open   # generate only (headless / SSH)
```

If you installed via the installer, `localflow-recover` is a shortcut for `localflow-agent --recover`, and there is a **LocalFlow Recovery** entry in the Start Menu (Windows) / applications menu (Linux).

#### Recovering from the command line

```bash
# List retained recordings newest-first
localflow-agent --list-failed-recordings

# Retry the newest unrecovered recording
localflow-agent --retry-latest-failed

# Retry a specific recording
localflow-agent --retry-failed-recording "C:\Users\you\.localflow\failed-recordings\localflow-failed-20260614-220000-1700000000.wav"

# Paste the recovered text at the cursor instead of copying to the clipboard
localflow-agent --retry-latest-failed --paste

# For an agent-mode (Alt+A) recording, also replay the web-search answer
localflow-agent --retry-latest-failed --retry-agent-query
```

By default a retry **copies the recovered text to your clipboard** and saves a sibling `.txt` transcript next to the WAV. The sidecar is marked `status: recovered` with the retry timestamp and transcript filename.

Retry is **local-first**: it reads the chosen WAV from disk and uploads only that single file to your configured transcription endpoint (`LOCALFLOW_API_URL`) using your Groq API key. No retained audio is uploaded unless you run a retry command. Agent-mode (`Alt+A`) recordings transcribe only by default — add `--retry-agent-query` to also replay the web-search voice-agent answer.

The same settings can be stored in `~/.localflow/config.json`:

```json
{
  "save_failed_recordings": true,
  "failed_recordings_dir": "C:\\Users\\you\\.localflow\\failed-recordings",
  "failed_recordings_retention_hours": 72
}
```

### Format Mode Voice Commands

When using **Alt+M** (format mode), these voice commands are interpreted:

- `"new line"` - Insert line break
- `"bullet"` / `"dash"` - Start bullet point
- `"number"` - Start numbered list
- `"indent"` - Increase indentation
- `"outdent"` - Decrease indentation

**Example:** "Buy groceries bullet milk bullet eggs new line call John" becomes:
```
- Buy groceries
  - Milk
  - Eggs

Call John
```

## Hotkey Options

**Raw Mode Hotkeys:**
- `alt+l` - Alt + L (default for raw mode)
- `alt+v` - Alt + V (legacy)

**Format Mode Hotkeys:**
- `alt+m` - Alt + M (default for format mode)
- Custom: Set `LOCALFLOW_FORMAT_HOTKEY` env var

**Selection Cleanup Hotkeys:**
- `alt+n` - Alt + N (default for highlighted-text cleanup)
- `alt+k` / `alt+p` - Supported alternates from the UI

**Selection Formatter Hotkeys:**
- `alt+j` - Alt + J (default for highlighted-text formatting)
- `ctrl+shift+j`, `ctrl+shift+k`, `ctrl+shift+f` - Supported alternatives

**Other Options:**
- `ctrl+shift+v` - Ctrl + Shift + V
- `cmd+shift+v` - Cmd + Shift + V (macOS)

## Troubleshooting

### Format Mode Not Working

**"CEREBRAS_API_KEY not set"**
- Get your free API key from: https://cloud.cerebras.ai/
- Add to your `.env` file: `CEREBRAS_API_KEY=csk-...`

**"Cerebras rate limit exceeded"**
- Free tier: 1M tokens/day, 30 requests/minute
- Wait a minute and try again, or upgrade at https://cerebras.ai/pricing

**"Format mode not activating"**
- Check agent logs for: `[INFO] Registering hotkeys:`
- Should show `alt+l`, `alt+m`, `alt+n`, and `alt+j` registrations as configured
- Try pressing the desired Alt hotkey firmly - both keys must be detected together

### "No audio device found"

Make sure you have a microphone connected and it's the default input device.

### "Connection failed"

Ensure the LocalFlow server is running:

```bash
cd /path/to/localflow
bun run dev:all
```

### "Permission denied" (Linux)

You may need to run with elevated permissions for the global hotkey to work in all applications.

### Terminal Applications (PowerShell, Windows Terminal)

**Symptom:** Hotkey triggers recording but leaves unwanted characters (e.g., repeated 'l' or 'm')

**Why:** Terminal emulators handle keyboard input differently than GUI applications. The agent suppresses hotkey events to prevent this, but timing variations can occasionally cause leakage.

**Solutions:**
1. Release both Alt and the letter key simultaneously
2. Try left Alt vs right Alt (behavior varies by system)
3. Run the agent as Administrator (recommended for Windows)
4. The issue is cosmetic - recording and pasting still work correctly

### macOS Permissions

Grant these permissions in System Preferences > Security & Privacy:

- Microphone access
- Accessibility (for keyboard simulation)

## Requirements

- Python 3.7+
- Working microphone
- LocalFlow server running
