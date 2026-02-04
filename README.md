# LocalFlow

A fast, private, AI-powered dictation system with dual-mode hotkey support.

**⚡ Lightning Fast** — Whisper transcription at ~50x real-time speed
**🎯 Dual Hotkeys** — Raw mode for speed, Format mode for structure
**🔒 Private** — Local processing options, no data retention
**🤖 Smart Formatting** — Voice commands for lists, outlines, indentation

---

## Quick Start

```bash
# Install dependencies
bun install
cd agent && pip install -r requirements.txt && cd ..

# Start all services
bun run dev:all

# In another terminal, start the desktop agent
cd agent && python localflow-agent.py
```

**Press and hold:**
- `Alt+L` — Raw transcription (fastest, no post-processing)
- `Alt+M` — Format mode (Cerebras LLM for outlines/lists)

Release to transcribe and auto-paste.

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

# Processing
PROCESSING_MODE=cloud           # cloud | networked-local | local
GROQ_API_KEY=your_key_here      # Get from https://groq.com/
# free teir more than enough for most daily dictation use
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

**"Hotkey not working"**
→ Check `agent/README.md` troubleshooting section

**"No audio device"**
→ Ensure microphone is default input device

See `agent/README.md` for more troubleshooting.
