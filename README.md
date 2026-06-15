# LocalFlow

A fast, private, AI-powered dictation system with dual-mode hotkey support.

**⚡ Lightning Fast** — Whisper transcription at ~50x real-time speed
**🎯 Multi-Mode Hotkeys** — Raw, outline, cleanup, and formatter shortcuts
**🌐 Translation** — Speak any language, get English output (Alt+T)
**🔒 Private** — Local processing options, no data retention
**🤖 Smart Formatting** — Voice commands for lists, outlines, indentation

---

## Desktop Agent Install Or Update

Normal users do not need to run the legacy local web stack. The desktop agent records audio, sends it to the hosted API at `https://dictate.agentmemorylabs.com`, and uses your Groq API key for BYOK transcription.

The installer clones the repo and installs the agent as a [uv](https://docs.astral.sh/uv/)-managed tool. uv is installed automatically if missing. This provides the `localflow-agent` and `localflow-recover` console commands and a Start Menu / applications entry.

### Windows

```powershell
irm https://dictate.agentmemorylabs.com/api/download?platform=windows | iex
```

### macOS / Linux

```bash
curl -fsSL "https://dictate.agentmemorylabs.com/api/download?platform=macos" | bash
# or:
curl -fsSL "https://dictate.agentmemorylabs.com/api/download?platform=linux" | bash
```

Then start the agent:

```bash
localflow-agent
```

To **update** later: re-run the installer (it does `git pull` + reinstalls), or from the checkout:

```bash
cd ~/.localflow/localflow && git pull && uv tool install --editable --force .
```

The agent reads the Groq key from `GROQ_API_KEY`, `LOCALFLOW_API_KEY`, or `~/.localflow/config.json`. On first run it prompts for the key and saves it.

---

## Local Development Quick Start

Use this when you are changing the Next.js app, API routes, or local development stack.

### Step 1: Install Dependencies

```bash
# Install Node dependencies
npm install

# Install the agent as an editable uv tool (creates localflow-agent + localflow-recover)
uv tool install --editable .
# If you don't have uv yet: irm https://astral.sh/uv/install.ps1 | iex  (Windows)
#                          curl -LsSf https://astral.sh/uv/install.sh | sh  (macOS/Linux)
```

### Step 2: Install CLI (Recommended)

Run this **once** to install the `localflow` command globally:

```powershell
# Windows (PowerShell):
.\scripts\install-cli.ps1

# Linux / macOS:
./scripts/install-cli.sh
```

**What this does:** Copies the startup script to `~/.local/bin/` and adds it to your PATH. After this, you can run `localflow` from **any directory**.

### Step 3: Use LocalFlow

```bash
# Start all services (from anywhere on your system)
localflow

# Stop all services
localflow --stop   # Linux/macOS
localflow -stop    # Windows
```

**Press and hold:**
- `Alt+L` — Raw transcription (fastest, no post-processing)
- `Alt+M` — Format mode (Cerebras LLM for outlines/lists)
- `Alt+T` — Toggle translation mode (🌐 speak any language → English)
- `Alt+A` — Voice agent (asks a question, web‑search grounded answer)

**Selection formatter:**
- `Alt+J` — Reformat highlighted text without recording audio
- `Alt+N` — Clean up highlighted text after a raw dictation pass

Release to transcribe and auto-paste.

---

### Alternative: Manual Start (No CLI Install)

If you prefer not to install the `localflow` dev CLI command:

```bash
# Terminal 1: Start web services
npm run dev:all

# Terminal 2: Start desktop agent (uses the uv-installed console command)
localflow-agent
```
```

See [scripts/README.md](scripts/README.md) for more details.

---

## Architecture

LocalFlow consists of three main components:

| Component | Purpose | Location |
|-----------|---------|----------|
| **Web UI** | Dictation interface, settings | `src/app/` |
| **WebSocket Service** | Real-time agent communication | `mini-services/websocket-service/` |
| **Desktop Agent** | Global hotkeys, audio capture | `agent/` |

### Processing Modes

| Mode | Description | Speed | Privacy |
|------|-------------|-------|---------|
| **Cloud** | Groq API for Whisper + optional LLM | Fastest | API only |
| **Networked-Local** | Remote Whisper/Ollama servers | Fast | Local network |
| **Local** | Everything on your machine | Depends on hardware | Fully private |

---

## Features

### Raw Mode (Alt+L)
- Direct Whisper transcription
- No post-processing latency
- Best for: Quick notes, code, speed-critical dictation

### Format Mode (Alt+M)
Uses **Cerebras GPT-OSS-120B** for intelligent formatting:

**Voice Commands:**
- `"bullet"` / `"dash"` → `- Item`
- `"number"` → `1. Item`
- `"indent"` → Add 2 spaces
- `"outdent"` → Remove 2 spaces
- `"new line"` / `"new paragraph"` → Line breaks

**Implicit Patterns:**
- `"First... Second... Third"` → Numbered list
- `"Also... Another... Plus"` → Bulleted list
- `"Under that... Sub-point"` → Indented items

**Why Cerebras?**
- ~3,000 tokens/sec (6x faster than alternatives)
- No content filtering (preserves expressive language)
- GPT-OSS-120B for better instruction following
- Generous free tier: 1M tokens/day

### Selected-Text Cleanup (Alt+N)
- Repairs punctuation, capitalization, spelling, and grammar on highlighted text
- Useful after raw mode or translation mode when literal punctuation words leak through
- Converts obvious spoken punctuation tokens like `slash`, `comma`, or `colon` into symbols when context clearly calls for them
- Preserves wording and intent while removing obvious ASR debris

---

## Configuration

Create `.env` from `.env.example`:

```bash
# Required for format mode
CEREBRAS_API_KEY=your_key_here  # Get from https://cloud.cerebras.ai/
CEREBRAS_MODEL=gpt-oss-120b

# Hotkeys
LOCALFLOW_HOTKEY=alt+l          # Raw mode
LOCALFLOW_FORMAT_HOTKEY=alt+m   # Format mode
LOCALFLOW_CLEANUP_HOTKEY=alt+n  # Clean highlighted text
LOCALFLOW_TRANSLATE_HOTKEY=alt+t # Toggle translation
LOCALFLOW_SELECTION_FORMAT_HOTKEY=alt+j # Format highlighted text

# Processing
PROCESSING_MODE=cloud           # cloud | networked-local | local
GROQ_API_KEY=your_key_here      # Get from https://groq.com/ (free tier is plenty)

# Failed recording recovery (desktop agent)
LOCALFLOW_SAVE_FAILED_RECORDINGS=true
LOCALFLOW_FAILED_RECORDINGS_DIR=~/.localflow/failed-recordings
LOCALFLOW_FAILED_RECORDINGS_RETENTION_HOURS=72

# Translation (optional)
TRANSLATION_PROMPT="Correct technical terms"  # Style guidance for translation
```

See `.env.example` for all options.

---

## Project Structure

```
.
├── agent/                    # Desktop agent (Python)
│   ├── localflow-agent.py   # Main agent with hotkeys
│   └── README.md            # Agent-specific docs
├── mini-services/
│   └── websocket-service/   # Bun + Socket.IO bridge
├── src/
│   └── app/
│       └── api/
│           └── dictation/
│               ├── transcribe/  # Whisper endpoints
│               └── refine/      # LLM formatting (Cerebras)
├── android/                 # Android remote mic app
├── CLAUDE.md               # Developer documentation
└── SETUP_GUIDE.md          # Detailed setup instructions
```

---

## Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Developer guide, architecture, implementation notes |
| `SETUP_GUIDE.md` | Step-by-step installation instructions |
| `SPEC.md` | Full technical specification |
| `agent/README.md` | Desktop agent usage and troubleshooting |
| `CHANGELOG.md` | Version history |

---

## Requirements

- **Runtime:** [Bun](https://bun.sh/) (JavaScript/TypeScript)
- **Agent:** Python 3.7+ with pip
- **OS:** Windows 10+, macOS 10.15+, Linux (X11/Wayland)

---

## License

MIT

---

## Troubleshooting

**"CEREBRAS_API_KEY not set"**
→ Get free key at https://cloud.cerebras.ai/

**"GROQ_API_KEY not set"**
→ Get free key at https://groq.com/

**"Hotkey not working"**
→ Check `agent/README.md` troubleshooting section

**"No audio device"**
→ Ensure microphone is default input device

**"localflow: command not found"**
→ The dev CLI isn't installed or your PATH wasn't updated. Run the install script again and restart your terminal:
```bash
# Windows
.\scripts\install-cli.ps1

# Linux/macOS
./scripts/install-cli.sh
```

**"localflow-agent: command not found"**
→ The desktop agent isn't installed as a uv tool. Install or reinstall it from the repo root:
```bash
uv tool install --editable --force .
```
If `uv` itself is missing, install it first: `irm https://astral.sh/uv/install.ps1 | iex` (Windows) or `curl -LsSf https://astral.sh/uv/install.sh | sh` (macOS/Linux), then re-run the installer.

**"Could not find LocalFlow project directory"**
→ If you moved the project folder after installing the CLI, set the `LOCALFLOW_HOME` environment variable:

```powershell
# Windows (PowerShell - run once)
[Environment]::SetEnvironmentVariable("LOCALFLOW_HOME", "C:\path\to\localflow", "User")

# Linux/macOS (add to ~/.bashrc or ~/.zshrc)
export LOCALFLOW_HOME="/path/to/localflow"
```

See `agent/README.md` and `scripts/README.md` for more troubleshooting.
