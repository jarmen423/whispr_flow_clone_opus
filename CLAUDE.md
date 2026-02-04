# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Using llama.cpp set up 
~/liquid-audio-demo/ director
from ~/liquid-audio-demo/ start llama-liquid-audio-server (shutdown whisper.cpp server) @ same ip and port as shut down whisper.cpp server

```bash
./runner/llama-liquid-audio-server -m LFM2.5-Audio-1.5B-Q4_0.gguf -mm mmproj-LFM2.5-Audio-1.5B-Q4_0.gguf -mv 
vocoder-LFM2.5-Audio-1.5B-Q4_0.gguf --tts-speaker-file tokenizer-LFM2.5-Audio-1.5B-Q4_0.gguf --host 100.111.169.60 --port 8888
```
## Project Overview

LocalFlow is a voice dictation system that transcribes speech to text and refines it using AI. The system supports three processing modes:

1. **Cloud Mode**: Fast processing via Z.AI API (requires API key, pay-per-use)
2. **Networked Local Mode** (default): Free processing using remote Whisper.cpp and Ollama servers on your network
3. **Local Mode**: Free processing with everything running on the same machine

## Common Development Commands

### Starting Everything (Recommended)

The easiest way to start all services is with the automated startup script:

```powershell
.\scripts\start-all.ps1
```

This script:
- **Auto-detects** your `PROCESSING_MODE` from `.env`
- Opens Windows Terminal with separate tabs for each service
- Only starts the remote LLM server when in `networked-local` mode

| Mode | Services Started |
|------|-----------------|
| `cloud` | Node.js servers + Python agent (2 tabs) |
| `networked-local` | Node.js servers + Python agent + Remote LLM via SSH (3 tabs) |
| `local` | Node.js servers + Python agent (2 tabs) |

### Starting the Application Manually

```bash
# Start both Next.js app and WebSocket service (recommended)
bun run dev:all

# Start individually
bun run dev          # Next.js app on port 3005
bun run dev:ws       # WebSocket service on port 3002
```

### Building and Production

```bash
bun run build        # Build Next.js app
bun run start        # Start production server
bun run start:ws     # Start WebSocket service in production
```

### Testing and Linting

```bash
bun run lint         # Run ESLint
bun run test         # Run Vitest tests
bun run test:watch   # Run tests in watch mode
```

### Running the Desktop Agent

```bash
cd agent
pip install -r requirements.txt
python localflow-agent.py
```

Default hotkeys:
- **`Alt+L`** - Raw mode (hold to record, release to transcribe)
- **`Alt+M`** - Format mode (same, but uses Cerebras LLM for outline/list formatting)

**Note:** As of v1.2.0, the default hotkey changed from `Alt+V` to `Alt+L`. Letter keys work more reliably with pynput's `GlobalHotKeys` class. All Alt variants are supported: left Alt, right Alt, AltGr.

## Architecture Overview

### System Components

```
┌─────────────────┐         ┌──────────────────┐
│   Web Browser   │◄───────►│  Next.js App     │
│   (page.tsx)    │   HTTP  │  (port 3005)     │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │ WebSocket                 │ API calls
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│ WebSocket       │◄───────►│  Transcribe API  │
│ Service         │         │  Refine API      │
│ (port 3002)     │         │                  │
└────────┬────────┘         └──────────────────┘
         │
         │ WebSocket
         │
         ▼
┌─────────────────┐
│ Desktop Agent   │
│ (Python)        │
│ Global Hotkey   │
└─────────────────┘
```

### Key Directories

- **`src/app/`** - Next.js App Router pages and API routes
  - `page.tsx` - Main recording UI
  - `api/dictation/transcribe/` - Speech-to-text endpoint
  - `api/dictation/refine/` - Text refinement endpoint
- **`src/components/ui/`** - shadcn/ui components (buttons, dialogs, etc.)
- **`src/hooks/use-websocket.ts`** - WebSocket connection management
- **`mini-services/websocket-service/`** - Socket.IO server (port 3002)
- **`agent/`** - Python desktop agent for global hotkey dictation

## Data Flow

### Cloud Mode Processing

1. Desktop Agent records audio (16kHz, mono, 16-bit WAV)
2. Converts to base64 and sends via WebSocket
3. POST to `/api/dictation/transcribe` (mode=cloud)
4. Next.js calls Z.AI ASR API → returns text
5. POST to `/api/dictation/refine` (mode=cloud)
6. Next.js calls Z.AI LLM API → returns refined text
7. WebSocket sends result back to agent
8. Agent copies to clipboard and sends Ctrl+V

### Local Mode Processing

1. Desktop Agent records audio
2. Sends via WebSocket to `/api/dictation/transcribe` (mode=local)
3. Next.js saves temp file and executes whisper.cpp binary
4. Reads output text file
5. POST to `/api/dictation/refine` (mode=local)
6. Next.js calls Ollama API (localhost:11434) → returns refined text
7. WebSocket sends result back to agent

## WebSocket Protocol

### Namespaces

- **`/agent`** - Desktop agent connections
- **`/ui`** - Web UI connections

### Agent → Server Messages

- **`ping`** - Heartbeat every 5 seconds
- **`process_audio`** - Dictation request with base64 audio
- **`recording_started`** - Notification when recording begins

### Server → Agent Messages

- **`connection_confirmed`** - Sent on successful connection
- **`dictation_result`** - Processing response with text
- **`settings_update`** - Broadcast from UI when settings change (includes translate, hotkeys, mode)

### Agent → Server Messages (Additional)

- **`translation_toggled`** - Agent toggled translation mode via hotkey
- **`process_audio`** - Now includes `translate` boolean field

### Server → UI Messages

- **`agent_status`** - Agent online/offline status
- **`update`** - Live activity (dictation_complete, recording_started)

## Environment Configuration

Key environment variables in `.env`:

```bash
# Processing mode: cloud | networked-local | local
PROCESSING_MODE=networked-local

# Cloud mode (requires ZAI_API_KEY)
ZAI_API_KEY=your_key_here

# Networked-local mode (requires WHISPER_API_URL)
WHISPER_API_URL=http://192.168.1.100:8080

# Local mode (requires WHISPER_PATH and WHISPER_MODEL_PATH)
WHISPER_PATH=/usr/local/bin/whisper
WHISPER_MODEL_PATH=./models/ggml-small-q5_1.bin

# Ollama (used for both networked-local and local)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2:1.5b
```

## Processing Mode Selection

The application automatically falls back between modes based on configuration:

- **Cloud** falls back to **networked-local** if `ZAI_API_KEY` is not set
- **Networked-local** falls back to **local** if `WHISPER_API_URL` is not set
- This is handled in `getEffectiveMode()` in both transcribe and refine routes

## Refinement Modes

The system supports five text refinement modes:

- **`developer`** (default): Corrects grammar, removes filler words, formats technical terms correctly
- **`concise`**: Shortens and simplifies text while keeping meaning
- **`professional`**: Transforms casual language into business-appropriate text
- **`raw`**: Returns transcription unchanged (no LLM call)
- **`outline`**: Format text with lists, indentation, and structure using voice commands

System prompts are defined in `src/app/api/dictation/refine/route.ts`.

## Translation Mode (🌐 Alt+T)

LocalFlow supports real-time translation of non-English speech to English using Whisper's translation capability.

### How It Works

1. **Toggle Translation**: Press `Alt+T` (or use the UI toggle) to enable translation mode
2. **Speak in any language**: Whisper auto-detects the source language
3. **Get English output**: Speech is translated to English text
4. **Translation-ese fix**: The refinement LLM corrects awkward grammar from raw translation

### Translation Pipeline

```
Spanish Speech → Whisper Translation → Raw English (may have awkward grammar)
                                       ↓
                            Refinement LLM (with translation prompt)
                                       ↓
                            Natural, fluent English output
```

### Translation-Aware Post-Processing

When `translated: true` is passed to the refinement API, the system prompt includes:

```
TRANSLATION NOTE: The input text is a raw machine translation from another language 
(likely Spanish) to English. It may contain:
- Non-native word order (e.g., "the car red" instead of "the red car")
- Literal translations of idioms that don't make sense in English
- Missing articles or incorrect prepositions

Your task: Detect and correct any "translation-ese" or grammatical awkwardness.
```

This fixes common Whisper translation issues like:
- "The car red" → "The red car"
- "I have hunger" → "I'm hungry"
- Incorrect article usage

### Supported Languages

Whisper supports 99+ languages including:
- Spanish, French, German, Italian, Portuguese
- Chinese, Japanese, Korean
- Arabic, Hindi, Russian
- And many more...

### Requirements

**Cloud Mode (Groq)**:
- Uses dedicated `/v1/audio/translations` endpoint
- Requires `whisper-large-v3` model (turbo does NOT support translation)
- Fastest option (~50x real-time)

**Networked-Local Mode**:
- Whisper.cpp server supports `task=translate` parameter
- Works with any Whisper.cpp server

**Note**: LFM 2.5 Audio does NOT support translation (transcription only).

### Configuration

```bash
# Optional: Set translation style prompt (max 224 tokens)
TRANSLATION_PROMPT="Use technical terminology. Correct spelling of Kubernetes."

# Optional: Customize translate hotkey (agent only)
LOCALFLOW_TRANSLATE_HOTKEY=alt+t
```

### UI Indicators

- **Blue "🌐 Translate" badge** appears in header when translation mode is active
- **Settings dialog** shows translation toggle with `Alt+T` shortcut
- **Toast notifications** confirm mode changes

### Outline Mode (Alt+M Format Mode)

The `outline` mode uses **Cerebras GPT-OSS-120B** for fast, uncensored text formatting. This mode is activated with the **`Alt+M`** hotkey (or via `LOCALFLOW_FORMAT_HOTKEY`).

**Voice Commands Supported:**
- `"new line"` - Insert line break
- `"new paragraph"` - Insert two line breaks
- `"bullet"` / `"dash"` / `"point"` - Start bullet point
- `"number"` / `"numbered list"` - Start numbered list
- `"indent"` / `"tab"` - Indent current item
- `"outdent"` / `"back"` - Remove indentation

**Implicit Patterns Detected:**
- `"First... Second... Third..."` → Numbered list
- `"Also... Another... Plus..."` → Bulleted list
- `"Under that... Sub-point..."` → Indented items

**Why Cerebras for Outline Mode:**
- ~3,000 tokens/sec (6x faster than alternatives)
- GPT-OSS-120B for better instruction following
- No content filtering (preserves profanity, expressive language)
- Generous free tier (1M tokens/day)
- OpenAI-compatible API

**Configuration:**
```bash
CEREBRAS_API_KEY=your_key_here
CEREBRAS_MODEL=gpt-oss-120b
LOCALFLOW_FORMAT_HOTKEY=alt+m  # Optional
```

## Desktop Agent Configuration

Set via environment variables:

```bash
LOCALFLOW_WS_URL=http://localhost:3002    # WebSocket server URL
LOCALFLOW_HOTKEY=alt+l                    # Global hotkey for raw mode (use letter keys)
LOCALFLOW_FORMAT_HOTKEY=alt+m             # Hotkey for format/outline mode
LOCALFLOW_TRANSLATE_HOTKEY=alt+t          # Hotkey to toggle translation mode
LOCALFLOW_TRANSLATE=false                 # Default translation mode (true/false)
LOCALFLOW_MODE=developer                  # Refinement mode
LOCALFLOW_PROCESSING=networked-local      # Processing mode
DEBUG=1                                   # Enable debug logging
```

**Hotkey Configuration (v1.2.0+)**
- Use letter keys: `alt+l`, `alt+v`, `alt+d`, etc.
- Avoid symbol keys like `/`, `?`, `-` (they share physical keys and are unreliable)
- All Alt variants are supported: left Alt, right Alt, AltGr

**Translation Hotkey (Alt+T)**
- Toggles translation mode on/off
- Shows visual overlay notification with current status
- Syncs with web UI via WebSocket

## Important Implementation Details

### Audio Format

- Sample rate: 16kHz
- Channels: 1 (mono)
- Bit depth: 16-bit PCM
- Format: WAV (native for Whisper.cpp)

This format is used by the Python agent to ensure compatibility with Whisper.cpp without transcoding.

### Temporary File Management

Local transcription creates temp files in `/tmp/localflow/`:
- Input: `audio_<timestamp>.wav`
- Output: `audio_<timestamp>.txt`

Files are cleaned up after processing. The temp directory is created automatically if it doesn't exist.

### Rate Limiting

- Max 30 messages per minute per agent (WebSocket service)
- Prevents abuse and manages resource usage

### Stale Connection Detection

- Agents are disconnected after 30 seconds of inactivity
- Checked every 10 seconds
- WebSocket service broadcasts offline status to UI

## Port Configuration

Default ports (can be changed via environment variables):

- **3005** - Next.js application (`PORT`)
- **3002** - WebSocket service (`WS_PORT`)
- **11434** - Ollama server
- **8080** - Whisper.cpp server (networked-local mode)

## UI Components

The application uses shadcn/ui components built on Radix UI primitives:
- Button, Card, Dialog, Select, Switch, Textarea, Label, Alert

Components are in `src/components/ui/` and follow the shadcn/ui pattern.

## Testing

Run tests with Vitest:

```bash
bun run test              # Run all tests
bun run test:watch        # Watch mode
bun run test:coverage     # Coverage report
```

Test files should be placed in a `tests/` directory.

## Troubleshooting

### "Whisper binary not found"

- Check `WHISPER_PATH` in `.env` points to the actual binary
- On Windows, use backslashes or double backslashes in paths

### "Ollama not responding"

- Ensure Ollama is running: `ollama serve`
- Check `OLLAMA_URL` is correct
- Test connection: `curl http://localhost:11434/api/tags`

### WebSocket connection issues

- Ensure both services are running: `bun run dev:all`
- Check ports are not already in use
- Verify `NEXT_PUBLIC_WS_URL` environment variable

### Desktop agent won't start

- Install Python dependencies: `pip install -r agent/requirements.txt`
- Check `LOCALFLOW_WS_URL` matches WebSocket service port
- On macOS, grant microphone and accessibility permissions

### Hotkey not working (v1.2.0+)

**Symptoms:**
- Pressing hotkey does nothing
- Recording doesn't start
- Keys type instead of triggering recording

**Solutions:**
1. Check agent logs for: `[INFO] Registering hotkeys: ['<alt_l>+l', '<alt_r>+l', '<alt_gr>+l']`
2. Verify hotkey uses letter key: `LOCALFLOW_HOTKEY=alt+l` (avoid `/`, `?`, `-`)
3. Try different Alt variants (left Alt, right Alt, AltGr)
4. On Windows, run agent as Administrator

**Why Letter Keys:**
Symbol keys share physical keys (e.g., `/` and `?` are the same key), making them unreliable for hotkeys. Letter keys work best with pynput's `GlobalHotKeys` class.

## Development Notes

- The application uses Bun for JavaScript runtime (faster than Node.js)
- Next.js 16 with React 19 and App Router
- TypeScript strict mode enabled
- WebSocket service uses Socket.IO with Bun runtime
- Desktop agent uses Python 3.7+ with standard libraries

### Important Implementation Learnings

**Hotkey Lambda Binding Issue**
When setting up multiple hotkeys with `GlobalHotKeys`, beware of Python lambda closure binding. Original code had:
```python
hotkeys[combo_str] = lambda: self._on_hotkey_press(format_mode=False)  # Wrong!
```
This creates late binding - all lambdas reference the same variable. Solution: use default parameters:
```python
hotkeys[combo_str] = (lambda fm=flag: self._on_hotkey_press(format_mode=fm))  # Correct
```

**Keyboard Event Suppression for Terminal Applications**
pynput's `GlobalHotKeys` only **detects** hotkeys - it never suppresses the underlying key events. This causes issues in terminal applications (PowerShell, Windows Terminal) where leaked key events can trigger repeat input (e.g., continuous 'm' or 'l' characters).

**Evidence:**
- `GlobalHotKeys` extends `Listener` but doesn't pass `suppress=True`
- Detection happens via `_on_press()` which never blocks event propagation
- Terminal emulators have different input handling that makes this more visible

**Solution:** Use a single `Listener` with manual key tracking and suppress events by returning `False` from callbacks:

```python
def on_press(key):
    # Track key state
    pressed_keys.add(key)
    
    # Check for hotkey (Alt + letter)
    if is_alt_pressed() and is_hotkey_char_pressed(target_char):
        start_recording()
        return False  # SUPPRESS the event - critical!
    
    return True  # Allow other keys

def on_release(key):
    pressed_keys.discard(key)
    
    if is_recording and is_hotkey_key(key):
        stop_recording()
        return False  # SUPPRESS release event
    
    return True  # Allow other keys

# Create listener without GlobalHotKeys
listener = keyboard.Listener(on_press=on_press, on_release=on_release)
```

**Key Implementation Details:**
- Suppress **both** press AND release events for hotkey-related keys
- Suppress during paste operations to prevent interference
- Use virtual key codes (`key.vk`) as fallback for character detection
- Reset state when recording stops to handle "rollover" releases

**Testing:** Always verify hotkey behavior in:
- PowerShell (most sensitive to key leakage)
- Windows Terminal
- VS Code terminal
- Regular GUI apps (should work normally)

**Whisper Prompting Limitations**
Whisper's `initial_prompt` does NOT interpret voice commands like "new line" as formatting. It uses style conditioning (continuation), not command execution. For structural formatting (lists, indentation), post-processing with an LLM is required.

**Cerebras API Specifics**
- System messages have **stronger influence** than OpenAI/Groq (good for strict formatting)
- Use `max_completion_tokens` NOT `max_tokens`
- `temperature: 0.3` works better than 1.0 for formatting tasks
- `reasoning_effort: "low"` reduces latency for simple formatting
- DO NOT use `frequency_penalty`, `presence_penalty`, or `logit_bias` (400 errors)

**Model Selection for Post-Processing**
- Groq GPT-OSS 20B: ~1,000 tok/s, good for general refinement
- Cerebras GPT-OSS 120B: ~3,000 tok/s, better instruction following, no censorship
- For formatting that preserves profanity/expressive language, Cerebras is preferred

**Free Tier Strategy**
Splitting free tiers across providers (Groq for transcription, Cerebras for formatting) maximizes daily quota without sacrificing speed or quality.
