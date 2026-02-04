# LocalFlow

A fast, private, AI-powered dictation system with dual-mode hotkey support.

**⚡ Lightning Fast** — Whisper transcription at ~50x real-time speed
**🎯 Dual Hotkeys** — Raw mode for speed, Format mode for structure
**🌐 Translation** — Speak any language, get English output (Alt+T)
**🔒 Private** — Local processing options, no data retention
**🤖 Smart Formatting** — Voice commands for lists, outlines, indentation

---

## Quick Start

### Step 1: Install Dependencies

```bash
# Install Node dependencies
npm install

# Setup Python virtual environment for the agent
cd agent
python -m venv .venv-whispr

# Activate venv (Windows)
.venv-whispr\Scripts\activate
# Activate venv (Linux/macOS)
source .venv-whispr/bin/activate

# Install Python dependencies
pip install -r requirements.txt
cd ..
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

Release to transcribe and auto-paste.

---

### Alternative: Manual Start (No CLI Install)

If you prefer not to install the CLI command:

```bash
# Terminal 1: Start web services
cd agent && source .venv-whispr/bin/activate && cd ..
npm run dev:all

# Terminal 2: Start desktop agent
cd agent && source .venv-whispr/bin/activate && python localflow-agent.py
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
LOCALFLOW_TRANSLATE_HOTKEY=alt+t # Toggle translation

# Processing
PROCESSING_MODE=cloud           # cloud | networked-local | local
GROQ_API_KEY=your_key_here      # Get from https://groq.com/ (free tier is plenty)

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
→ The CLI isn't installed or your PATH wasn't updated. Run the install script again and restart your terminal:
```bash
# Windows
.\scripts\install-cli.ps1

# Linux/macOS
./scripts/install-cli.sh
```

**"Could not find LocalFlow project directory"**
→ If you moved the project folder after installing the CLI, set the `LOCALFLOW_HOME` environment variable:

```powershell
# Windows (PowerShell - run once)
[Environment]::SetEnvironmentVariable("LOCALFLOW_HOME", "C:\path\to\localflow", "User")

# Linux/macOS (add to ~/.bashrc or ~/.zshrc)
export LOCALFLOW_HOME="/path/to/localflow"
```

See `agent/README.md` and `scripts/README.md` for more troubleshooting.
