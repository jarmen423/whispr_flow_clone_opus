# LocalFlow Desktop Agent

The LocalFlow desktop agent enables system-wide dictation with a global hotkey. Press and hold the hotkey to record, release to transcribe and paste.

## Quick Start

### 1. Install Dependencies

```bash
pip install pynput sounddevice scipy python-socketio pyperclip pyautogui numpy
```

### 2. Run the Agent

```bash
python localflow-agent.py
```

### 3. Use

**Three hotkey modes are available:**

| Hotkey | Mode | Description |
|--------|------|-------------|
| `Alt+L` | Raw | Fast transcription without post-processing |
| `Alt+M` | Format | Transcription with Cerebras LLM formatting (lists, outlines, indentation) |
| `Alt+T` | Toggle | Toggle translation mode (🌐 speak any language → English) |

1. Press and hold your chosen hotkey (Alt+L or Alt+M)
2. Speak clearly (include voice commands like "bullet", "new line" in format mode)
3. Release the keys
4. Text is automatically pasted at your cursor

**Translation Mode:**
Press `Alt+T` to toggle translation on/off. When enabled, speak in any language and get English output.

## Configuration

Set these environment variables:

| Variable                   | Default                    | Description                                                                |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `LOCALFLOW_WS_URL`         | `http://localhost:3002`     | WebSocket server URL                                                       |
| `LOCALFLOW_HOTKEY`         | `alt+l`                    | Global hotkey for raw mode                                                 |
| `LOCALFLOW_FORMAT_HOTKEY`  | `alt+m`                    | Hotkey for format mode (uses Cerebras LLM for outlines/lists)              |
| `LOCALFLOW_TRANSLATE_HOTKEY` | `alt+t`                  | Hotkey to toggle translation mode                                          |
| `LOCALFLOW_TRANSLATE`      | `false`                    | Default translation mode (true/false)                                      |
| `LOCALFLOW_MODE`           | `developer`                | Refinement mode (developer, concise, professional, raw, outline)           |
| `LOCALFLOW_PROCESSING`     | `cloud`                    | Processing mode (cloud, networked-local, local)                            |
| `DEBUG`                    | -                          | Set to any value for debug logging                                         |
| `CEREBRAS_API_KEY`         | -                          | Required for format mode (get from https://cloud.cerebras.ai/)             |

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
- Should show both `alt+l` and `alt+m` hotkeys
- Try pressing Alt+M firmly - both keys must be detected together

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
