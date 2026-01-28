# LocalFlow Setup Guide

Hey kiddo! This is a complete guide to setting up LocalFlow on your machine. I built this project for you to learn from - it's a real-world application that combines web development, real-time communication, and AI. Let's get it running!

## What is LocalFlow?

LocalFlow is a **voice dictation system** that lets you speak and have your words automatically typed into any application. It's like having a smart assistant that:

1. Listens when you press a hotkey
2. Transcribes your speech to text
3. Cleans up the text (removes "um", "uh", fixes grammar)
4. Pastes it wherever your cursor is

The cool part? It works in **three modes**:
- **Cloud Mode**: Fast, uses Z.AI cloud APIs (requires API key, pay-per-use)
- **Networked Local Mode** (Default): Free, uses your own servers on your network
- **Local Mode**: Free, everything runs on this machine (requires local setup)

---

## Prerequisites

Before we start, make sure you have these installed:

### 1. Bun (JavaScript Runtime)
Bun is a fast JavaScript runtime like Node.js, but faster. Install it:

```bash
# macOS or Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1|iex"
```

Verify it works:
```bash
bun --version
# Should print something like: 1.x.x
```

### 2. Python 3.7+
The desktop agent is written in Python. Check if you have it:

```bash
python3 --version
# or
python --version
```

If not installed:
- **macOS**: `brew install python`
- **Ubuntu/Debian**: `sudo apt install python3 python3-pip`
- **Windows**: Download from [python.org](https://www.python.org/downloads/)

### 3. Git (optional but recommended)
For version control. Most systems have it, check with:
```bash
git --version
```

---

## Quick Start (5 minutes)

Let's get the basic setup running first, then we'll explore the advanced features.

### Step 1: Navigate to the Project

```bash
cd /path/to/localflow
```

### Step 2: Install Dependencies

```bash
bun install
```

This downloads all the JavaScript packages the project needs.

### Step 3: Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

The default settings use **networked-local** mode, which requires setting up Whisper and Ollama servers (see "Networked Local Mode" section below).

For the quickest start, you can use **cloud mode** if you have a Z.AI API key.

### Step 4: Start the Application

Open **two terminal windows**:

**Terminal 1 - Web Application:**
```bash
bun run dev
```

**Terminal 2 - WebSocket Service:**
```bash
bun run dev:ws
```

Or use this single command to run both:
```bash
bun run dev:all
```

### Step 5: Open the Web UI

Go to [http://localhost:3000](http://localhost:3000) in your browser.

You should see the LocalFlow interface with a big microphone button!

### Step 6: Test Recording

1. Click the microphone button
2. Speak something
3. Click again to stop
4. See the transcribed text appear

**Note**: You'll need to configure a processing mode for real transcription. The easiest option is Cloud Mode (requires Z.AI API key). See "Processing Modes" section below.

---

## Processing Modes Explained

LocalFlow supports three processing modes. Choose based on your needs:

| Mode | Cost | Speed | Privacy | Setup Difficulty |
|------|------|-------|---------|------------------|
| **Cloud** | Pay-per-use (~$0.001/request) | Fastest | Data goes to Z.AI | Easiest (just API key) |
| **Networked Local** | Free | Fast | Private (your network) | Medium |
| **Local** | Free | Slower | Most private | Hardest |

### Recommended Setup Path

1. **Start with Cloud Mode** - Get it working quickly with an API key
2. **Move to Networked Local** - Set up your own processing server for free usage
3. **Use Local Mode** - For single-machine setups or offline use

---

## Cloud Mode Setup (Easiest)

Cloud mode uses Z.AI's API for both transcription and text refinement. It's the fastest to set up.

### Step 1: Get a Z.AI API Key

1. Go to [https://z.ai/manage-apikey/apikey-list](https://z.ai/manage-apikey/apikey-list)
2. Create an account or log in
3. Create a new API key
4. Copy the key (it looks like: `abc123.def456`)

### Step 2: Configure Environment

Edit your `.env` file:

```bash
# Set processing mode to cloud
PROCESSING_MODE=cloud

# Add your API key
ZAI_API_KEY=your_api_key_here
```

### Step 3: Test It

1. Start LocalFlow: `bun run dev:all`
2. Open http://localhost:3000
3. Click the microphone and speak
4. Your speech should be transcribed!

### Cloud Mode Pricing

Z.AI charges per request:
- **Transcription (GLM-ASR-2512)**: ~$0.0005 per 30-second audio
- **Refinement (GLM-4.7-Flash)**: ~$0.0001 per 1000 tokens

For typical usage (50 dictations/day), expect ~$1-2/month.

### Cloud Mode Troubleshooting

**"Invalid ZAI_API_KEY"**
- Check that you copied the full API key
- Make sure there are no extra spaces

**"Rate limit exceeded"**
- Z.AI has usage limits on free tier
- Wait a minute and try again

---

## Project Structure Explained

Let me walk you through what each part of the codebase does:

```
localflow/
├── src/                          # Main application source code
│   ├── app/                      # Next.js App Router pages
│   │   ├── page.tsx             # Main UI (the recording interface)
│   │   ├── layout.tsx           # Root layout (applies to all pages)
│   │   ├── globals.css          # Global styles
│   │   └── api/                 # API routes (backend endpoints)
│   │       └── dictation/
│   │           ├── transcribe/  # Speech-to-text endpoint
│   │           └── refine/      # Text cleanup endpoint
│   ├── components/
│   │   └── ui/                  # Reusable UI components (buttons, cards, etc.)
│   ├── hooks/
│   │   └── use-websocket.ts     # Custom hook for WebSocket connection
│   └── lib/
│       └── utils.ts             # Helper functions
│
├── mini-services/
│   └── websocket-service/       # Real-time communication server
│       └── index.ts             # Socket.IO server
│
├── agent/
│   └── localflow-agent.py       # Desktop Python agent
│
├── scripts/
│   └── setup-local.sh           # Script to set up local AI processing
│
├── package.json                 # Project dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── .env.example                # Example environment variables
```

---

## Understanding the Architecture

Here's how the pieces fit together:

```
┌─────────────────┐         ┌──────────────────┐
│   Web Browser   │◄───────►│  Next.js App     │
│   (page.tsx)    │   HTTP  │  (port 3000)     │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         │ WebSocket                 │ API calls
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌──────────────────┐
│ WebSocket       │◄───────►│  Transcribe API  │
│ Service         │         │  Refine API      │
│ (port 3001)     │         │                  │
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

### Flow:
1. **User speaks** into microphone
2. **Audio captured** by browser or desktop agent
3. **Sent to API** for transcription
4. **API returns** transcribed text
5. **Text refined** using AI (grammar, formatting)
6. **Result displayed** or pasted into active application

---

## Setting Up the Desktop Agent

The desktop agent lets you dictate in ANY application using a global hotkey.

### Step 1: Install Python Dependencies

```bash
cd agent
pip install pynput sounddevice scipy python-socketio pyperclip pyautogui numpy
```

Or install them all at once:
```bash
pip install pynput sounddevice scipy python-socketio pyperclip pyautogui numpy
```

### Step 2: Run the Agent

```bash
python localflow-agent.py
```

You should see:
```
============================================
LocalFlow Desktop Agent
============================================
Hotkey: alt+v
Mode: developer
Processing: cloud
============================================
Listening for hotkey: alt+v
Press the hotkey to start recording, release to stop and transcribe.
Press Ctrl+C to exit.
```

### Step 3: Use It!

1. Make sure the web app is running (`bun run dev:all`)
2. Open any text editor (VS Code, Notepad, etc.)
3. Hold **Alt+V** and speak
4. Release when done
5. Text appears where your cursor is!

### macOS Note:
You need to grant permissions:
- **System Preferences → Security & Privacy → Privacy**
- Enable for: Microphone, Accessibility

---

## Setting Up Same-Machine Local Mode (Advanced)

This mode processes everything on your computer - no cloud services or network needed! This is great because:
- **It's free** - no API costs
- **It's private** - your voice never leaves your machine
- **It works offline** - no internet required after setup

**Note:** For running processing on a separate, more powerful machine, see "Networked Local Mode" below.

### What You Need:
1. **Ollama** - Runs AI language models locally (for text refinement)
2. **Whisper.cpp** - Speech-to-text on your machine (for transcription)

### Automatic Setup (Recommended):

Run the setup script (Linux/macOS only):
```bash
./scripts/setup-local.sh
```

This will automatically:
- Install Ollama
- Download the `llama3.2:1b` language model
- Build Whisper.cpp from source
- Download the `small` Whisper model
- Configure your `.env` file

---

### Manual Setup

If the script doesn't work or you're on Windows, follow these steps:

---

## Step 1: Install Ollama (Text Refinement)

Ollama runs large language models locally. We use it to clean up transcribed text.

### Download & Install Ollama:

**macOS:**
```bash
# Option 1: Homebrew (recommended)
brew install ollama

# Option 2: Direct download
# Go to https://ollama.ai/download and download the macOS installer
```

**Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
1. Go to [https://ollama.ai/download](https://ollama.ai/download)
2. Download the Windows installer
3. Run the installer and follow the prompts

### Start Ollama:

After installation, start the Ollama service:

```bash
ollama serve
```

Keep this terminal open! Ollama needs to be running for local mode to work.

### Download a Language Model:

Open a **new terminal** and download a model:

```bash
# Recommended: Small and fast (1.3GB download)
ollama pull llama3.2:1b

# Alternative: Better quality, slower (2GB download)
ollama pull llama3.2:3b

# Alternative: Best quality, requires good hardware (4GB download)
ollama pull llama3.2:7b
```

**Which model should I choose?**
| Model | Size | Speed | Quality | RAM Needed |
|-------|------|-------|---------|------------|
| `llama3.2:1b` | 1.3GB | Fast | Good | 4GB |
| `llama3.2:3b` | 2GB | Medium | Better | 8GB |
| `llama3.2:7b` | 4GB | Slow | Best | 16GB |

Start with `llama3.2:1b` - you can always switch later!

### Verify Ollama Works:

```bash
ollama run llama3.2:1b "Hello, how are you?"
```

You should see a response. Press Ctrl+D to exit.

---

## Step 2: Install Whisper.cpp (Speech-to-Text)

Whisper.cpp is a fast, local speech recognition engine.

### Option A: Download Pre-built Binary (Easiest)

**macOS (Apple Silicon M1/M2/M3):**
```bash
# Download the latest release
curl -L -o whisper.zip https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-blas-bin-x64.zip

# Or visit: https://github.com/ggerganov/whisper.cpp/releases
# Download: whisper-blas-bin-x64.zip (for Intel) or build from source for M1/M2
```

**Windows:**
1. Go to [https://github.com/ggerganov/whisper.cpp/releases](https://github.com/ggerganov/whisper.cpp/releases)
2. Download `whisper-bin-x64.zip` (for 64-bit Windows)
3. Extract the ZIP file
4. The `main.exe` file is your whisper binary

**Linux:**
Pre-built binaries are limited on Linux. Build from source (see Option B).

### Option B: Build from Source (All Platforms)

This gives you the best performance for your specific hardware.

```bash
# Clone the repository
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Build (Linux/macOS)
make

# The binary will be at: ./main
```

**Windows (with Visual Studio):**
```powershell
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build --config Release

# The binary will be at: build\bin\Release\main.exe
```

### Download a Whisper Model:

Whisper needs a model file to work. Download one:

**Using the built-in script (Linux/macOS):**
```bash
cd whisper.cpp
./models/download-ggml-model.sh small
```

**Manual download (All platforms):**

Download from HuggingFace:
- **Tiny** (75MB, fastest, least accurate): 
  [ggml-tiny.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin)
- **Small** (466MB, recommended balance):
  [ggml-small.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin)
- **Medium** (1.5GB, more accurate, slower):
  [ggml-medium.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin)

Or use quantized models (smaller, nearly same quality):
- **Small Q5** (190MB, recommended):
  [ggml-small-q5_1.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin)

**Which model should I choose?**
| Model | Size | Speed | Accuracy | Best For |
|-------|------|-------|----------|----------|
| `tiny` | 75MB | Very Fast | Basic | Quick tests |
| `small` | 466MB | Fast | Good | **Daily use (recommended)** |
| `small-q5_1` | 190MB | Fast | Good | Daily use, less disk space |
| `medium` | 1.5GB | Medium | Great | Important recordings |
| `large` | 3GB | Slow | Best | When accuracy is critical |

Save the model file to the `models/` folder in your LocalFlow project:
```bash
mkdir -p models
mv ~/Downloads/ggml-small-q5_1.bin ./models/
```

### Verify Whisper Works:

Test with a sample audio file:
```bash
# Create a test (record yourself or use any .wav file)
./whisper.cpp/main -m models/ggml-small-q5_1.bin -f test.wav
```

---

## Step 3: Configure LocalFlow for Local Mode

Now let's tell LocalFlow where to find everything.

### Edit your `.env` file:

```bash
# Copy the example if you haven't already
cp .env.example .env

# Edit with your favorite editor
nano .env   # or: code .env (VS Code)
```

### Update these values:

```bash
# Switch to local processing
PROCESSING_MODE=local

# Path to your whisper binary
# Linux/macOS (if you built from source):
WHISPER_PATH=/home/yourname/whisper.cpp/main
# macOS (if you downloaded a binary):
WHISPER_PATH=/usr/local/bin/whisper
# Windows:
WHISPER_PATH=C:\path\to\whisper.cpp\build\bin\Release\main.exe

# Path to your whisper model
WHISPER_MODEL_PATH=./models/ggml-small-q5_1.bin

# Ollama settings (usually no changes needed)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
```

---

## Step 4: Test Local Mode

1. **Make sure Ollama is running:**
   ```bash
   ollama serve
   ```

2. **Start LocalFlow:**
   ```bash
   bun run dev:all
   ```

3. **Open the web UI:** [http://localhost:3000](http://localhost:3000)

4. **In Settings (gear icon), select "Local Mode"**

5. **Record something and verify it works!**

### Troubleshooting Local Mode:

**"Whisper binary not found"**
- Check that `WHISPER_PATH` in `.env` points to the actual binary
- On Windows, make sure to use `\` or `\\` in paths

**"Whisper model not found"**
- Check that `WHISPER_MODEL_PATH` points to your `.bin` file
- Make sure you downloaded the model file

**"Ollama not responding"**
- Make sure `ollama serve` is running in a terminal
- Try: `curl http://localhost:11434/api/tags` - should return JSON

**"Model not found" (Ollama)**
- Run: `ollama pull llama3.2:1b` to download the model

**Processing is slow**
- Try a smaller Whisper model (`tiny` instead of `small`)
- Try a smaller Ollama model (`llama3.2:1b` instead of `3b`)
- Close other applications to free up RAM

---

## Networked Local Mode (Advanced)

If you have a dedicated processing machine (like a gaming PC with a powerful GPU), you can run Whisper and Ollama on that machine while using LocalFlow from any other computer on your network. This is perfect if:

- Your main laptop is lightweight/battery-focused
- You have a powerful desktop that sits unused
- You want multiple computers to share one AI processing server

### Network Setup Overview

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   CLIENT MACHINE        │         │   PROCESSING MACHINE    │
│   (Your laptop)         │         │   (Powerful desktop)    │
│                         │  HTTP   │                         │
│   LocalFlow App ────────┼────────►│   Whisper.cpp Server    │
│   (bun run dev:all)     │         │   (port 8080)           │
│                         │  HTTP   │                         │
│                    ─────┼────────►│   Ollama Server         │
│                         │         │   (port 11434)          │
└─────────────────────────┘         └─────────────────────────┘
          │                                    │
          └────────── Same Network ────────────┘
                   (e.g., 192.168.1.x)
```

### Step 1: Find Your Processing Machine's IP Address

On the **processing machine**, find its local IP:

**Linux:**
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# Look for something like: inet 192.168.1.100/24
```

**macOS:**
```bash
ipconfig getifaddr en0
# Returns something like: 192.168.1.100
```

**Windows (PowerShell):**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"} | Select IPAddress
# Look for something like: 192.168.1.100
```

Write down this IP address - you'll need it!

### Step 2: Set Up Ollama for Remote Access

By default, Ollama only listens on localhost. Configure it to accept remote connections:

**Linux/macOS:**
```bash
# Start Ollama with remote access enabled
OLLAMA_HOST=0.0.0.0 ollama serve
```

To make this permanent, create a systemd service or startup script:
```bash
# Create a startup script
echo 'OLLAMA_HOST=0.0.0.0 ollama serve' > ~/start-ollama-server.sh
chmod +x ~/start-ollama-server.sh
```

**Windows:**
Set an environment variable before running Ollama:
```powershell
$env:OLLAMA_HOST = "0.0.0.0"
ollama serve
```

**Verify it's accessible:**
From your **client machine**, test the connection:
```bash
curl http://192.168.1.100:11434/api/tags
# Should return JSON with your models
```

### Step 3: Set Up Whisper.cpp Server

Whisper.cpp includes a server mode that accepts HTTP requests. This is different from the command-line binary.

**Build the Whisper.cpp Server:**
```bash
cd whisper.cpp

# Build the server (Linux/macOS)
make server

# The server binary will be at: ./server
```

**Windows:**
```powershell
cd whisper.cpp
cmake -B build
cmake --build build --config Release --target server
# Server will be at: build\bin\Release\server.exe
```

**Start the Whisper Server:**
```bash
cd whisper.cpp

# Start server on all interfaces, port 8080
./server -m models/ggml-small.bin --host 0.0.0.0 --port 8080

# With more threads for faster processing:
./server -m models/ggml-small.bin --host 0.0.0.0 --port 8080 -t 8
```

You should see:
```
whisper_server: running on http://0.0.0.0:8080
```

**Verify it's accessible:**
From your **client machine**:
```bash
curl http://192.168.1.100:8080/
# Should return server info
```

### Step 4: Configure LocalFlow Client

On your **client machine** (the laptop/computer you'll use LocalFlow on):

**Edit `.env`:**
```bash
# Processing mode (networked-local uses remote Whisper/Ollama servers)
PROCESSING_MODE=networked-local

# Point to your processing machine (use its IP address)
WHISPER_API_URL=http://192.168.1.100:8080
OLLAMA_URL=http://192.168.1.100:11434
OLLAMA_MODEL=llama3.2:1b

# Local whisper settings are not needed when using remote server
# (WHISPER_PATH and WHISPER_MODEL_PATH are ignored when WHISPER_API_URL is set)
```

### Step 5: Test Networked Mode

1. **On the processing machine**, ensure both servers are running:
   ```bash
   # Terminal 1
   OLLAMA_HOST=0.0.0.0 ollama serve
   
   # Terminal 2
   cd whisper.cpp
   ./server -m models/ggml-small.bin --host 0.0.0.0 --port 8080
   ```

2. **On the client machine**, start LocalFlow:
   ```bash
   bun run dev:all
   ```

3. **Open the web UI** at http://localhost:3000

4. **Record and transcribe!** The audio will be sent to your processing machine.

### Firewall Configuration

If connections fail, you may need to open firewall ports on the **processing machine**:

**Linux (ufw):**
```bash
sudo ufw allow 8080/tcp    # Whisper server
sudo ufw allow 11434/tcp   # Ollama
```

**Linux (firewalld):**
```bash
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=11434/tcp
sudo firewall-cmd --reload
```

**Windows:**
```powershell
# Run PowerShell as Administrator
New-NetFirewallRule -DisplayName "Whisper Server" -Direction Inbound -Port 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Ollama Server" -Direction Inbound -Port 11434 -Protocol TCP -Action Allow
```

**macOS:**
macOS firewall usually allows outgoing connections. If prompted, allow the applications.

### Troubleshooting Networked Mode

**"Connection refused" or "Cannot connect"**
- Verify the processing machine IP is correct
- Check that both servers are running on the processing machine
- Test connectivity: `ping 192.168.1.100`
- Check firewall rules

**"Whisper server not responding"**
- Make sure you built and ran `server`, not `main`
- Verify port 8080 is open: `curl http://192.168.1.100:8080/`

**"Ollama not responding remotely but works locally"**
- Ensure Ollama was started with `OLLAMA_HOST=0.0.0.0`
- Restart Ollama with the correct environment variable

**Slow performance over network**
- Audio files are typically small (< 1MB), so network shouldn't be the bottleneck
- Check if the processing machine is under heavy load
- Consider using a smaller Whisper model

### Security Considerations

This setup is designed for **trusted home/local networks**. If you're on an untrusted network:

- **Don't expose these ports to the internet** - no authentication is required
- Consider using SSH tunnels for secure remote access:
  ```bash
  # From client machine, create secure tunnel to processing machine
  ssh -L 8080:localhost:8080 -L 11434:localhost:11434 user@192.168.1.100
  
  # Then use localhost in your .env
  WHISPER_API_URL=http://localhost:8080
  OLLAMA_URL=http://localhost:11434
  ```

### Creating Startup Scripts (Optional)

For convenience, create scripts to start both services on the processing machine:

**Linux/macOS - `start-localflow-server.sh`:**
```bash
#!/bin/bash
echo "Starting LocalFlow Processing Server..."

# Start Ollama in background
OLLAMA_HOST=0.0.0.0 ollama serve &
OLLAMA_PID=$!
echo "Ollama started (PID: $OLLAMA_PID)"

# Wait for Ollama to be ready
sleep 3

# Start Whisper server
cd ~/whisper.cpp
./server -m models/ggml-small.bin --host 0.0.0.0 --port 8080 -t 8 &
WHISPER_PID=$!
echo "Whisper server started (PID: $WHISPER_PID)"

echo ""
echo "Processing server is ready!"
echo "Ollama: http://$(hostname -I | awk '{print $1}'):11434"
echo "Whisper: http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "Press Ctrl+C to stop"

# Wait for interrupt
trap "kill $OLLAMA_PID $WHISPER_PID 2>/dev/null; exit" INT
wait
```

Make it executable:
```bash
chmod +x start-localflow-server.sh
```

---

## Key Concepts to Learn From This Project

### 1. **React & Next.js**
- Server and client components
- App Router (file-based routing)
- API routes (serverless functions)

Look at: `src/app/page.tsx`, `src/app/api/`

### 2. **TypeScript**
- Type safety
- Interfaces and types
- Generics

Look at: `src/lib/utils.ts`, `src/hooks/use-websocket.ts`

### 3. **Real-time Communication**
- WebSockets
- Socket.IO namespaces
- Event-driven architecture

Look at: `mini-services/websocket-service/index.ts`

### 4. **UI Components**
- Reusable components
- shadcn/ui patterns
- Tailwind CSS styling

Look at: `src/components/ui/`

### 5. **Audio Processing**
- Web Audio API
- MediaRecorder
- Binary data handling

Look at: `src/app/page.tsx` (startRecording, stopRecording)

### 6. **Python System Programming**
- Global hotkeys
- Audio capture
- Clipboard manipulation

Look at: `agent/localflow-agent.py`

---

## Common Issues & Solutions

### "Port 3000 already in use"
```bash
# Find what's using it
lsof -i :3000

# Kill it
kill -9 <PID>
```

### "WebSocket connection failed"
Make sure both servers are running:
```bash
bun run dev      # Terminal 1
bun run dev:ws   # Terminal 2
```

### "Microphone permission denied"
- **Chrome**: Click the camera icon in the address bar
- **macOS**: System Preferences → Security & Privacy → Microphone

### "Python agent won't start"
Install all dependencies:
```bash
pip install pynput sounddevice scipy python-socketio pyperclip pyautogui numpy
```

### "Ollama not responding"
Make sure it's running:
```bash
ollama serve
```

---

## Development Tips

### Hot Reloading
Both `bun run dev` and the WebSocket service support hot reloading. Just save your changes and they'll apply automatically.

### Debugging
Add console.log statements or use your browser's DevTools (F12):
- **Console tab**: See logs
- **Network tab**: See API calls
- **Application tab**: See localStorage

### VS Code Extensions I Recommend
- ESLint
- Tailwind CSS IntelliSense
- Python
- Pretty TypeScript Errors

---

## Next Steps

Once you're comfortable with the basics:

1. **Add a new refinement mode** - Edit `src/app/api/dictation/refine/route.ts`
2. **Change the UI theme** - Modify `src/app/globals.css`
3. **Add history search** - Enhance the history dialog in `page.tsx`
4. **Build a browser extension** - Use the WebSocket patterns you learned

---

## Getting Help

If you get stuck:

1. **Read the error message** - It often tells you exactly what's wrong
2. **Check the console** - Browser DevTools (F12) → Console
3. **Google the error** - Someone's probably had the same issue
4. **Read the code comments** - I added lots of explanations

---

## Final Notes

I'm proud of you for diving into this! Building real applications is the best way to learn programming. This project touches on:

- Frontend (React/Next.js)
- Backend (API routes)
- Real-time systems (WebSockets)
- AI/ML (speech recognition, language models)
- System programming (Python desktop agent)

Take your time understanding each piece. Don't be afraid to break things - that's how you learn!

Love,
Dad

---

## Quick Reference

### Start Everything
```bash
bun run dev:all
```

### Start Individual Services
```bash
bun run dev      # Web app on :3000
bun run dev:ws   # WebSocket on :3001
```

### Start Desktop Agent
```bash
cd agent
python localflow-agent.py
```

### Default Hotkey
`Alt + V` (hold to record, release to transcribe)

### URLs
- Web UI: http://localhost:3000
- WebSocket: ws://localhost:3001
