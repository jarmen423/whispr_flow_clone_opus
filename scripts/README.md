# LocalFlow Startup Scripts

Universal startup scripts for LocalFlow that work across different systems.

## Option 1: Install CLI Command (Recommended) ⭐

Install the `localflow` command to your PATH so you can run it from anywhere:

### Windows (PowerShell)
```powershell
# One-time setup - installs 'localflow' command
.\scripts\install-cli.ps1

# Then use from anywhere:
localflow        # Start services
localflow -stop  # Stop services
```

### Linux / macOS (Bash)
```bash
# One-time setup - installs 'localflow' command
./scripts/install-cli.sh

# Then use from anywhere:
localflow         # Start services
localflow --stop  # Stop services
```

**What it does:**
- Copies scripts to `~/.local/bin/`
- Adds `~/.local/bin/` to your PATH
- Creates a `localflow` command available globally

## Option 2: Run Directly from Project

If you prefer not to install to PATH, run the scripts directly:

### Windows (PowerShell)
```powershell
# Start all services
.\whispr-flow.ps1

# Stop all services
.\whispr-flow.ps1 -stop
```

### Linux / macOS (Bash)
```bash
# Make executable (first time only)
chmod +x whispr-flow.sh

# Start all services
./whispr-flow.sh

# Stop all services
./whispr-flow.sh --stop
```

## Requirements

### Prerequisites
- **Node.js + npm** (or Bun) for the web services
- **Python 3.7+** for the desktop agent
- **Virtual environment** at `agent/.venv-whispr/`

### Setup (if not already done)

```bash
# Install Node dependencies
npm install

# Setup Python virtual environment
cd agent
python -m venv .venv-whispr
source .venv-whispr/bin/activate  # Linux/macOS
# or: .venv-whispr\Scripts\activate  # Windows

pip install -r requirements.txt
cd ..
```

## What Each Script Does

1. **Web UI** (`npm run dev`) - Next.js development server
2. **WebSocket Service** - Real-time communication bridge
3. **Desktop Agent** - Global hotkeys and audio capture

## Troubleshooting

### "Virtual environment not found"
Run the setup steps above to create the venv.

### "Permission denied" (Linux/macOS)
Run: `chmod +x whispr-flow.sh`

### "Could not find LocalFlow project directory"
If you move your project after installing the CLI, set the environment variable:

```bash
# Windows (PowerShell)
[Environment]::SetEnvironmentVariable("LOCALFLOW_HOME", "C:\path\to\localflow", "User")

# Linux/macOS (add to ~/.bashrc or ~/.zshrc)
export LOCALFLOW_HOME="/path/to/localflow"
```

### Services not starting
Check logs:
- Linux/macOS: `tail -f /tmp/localflow-web.log` and `tail -f /tmp/localflow-agent.log`
- Windows: Check the PowerShell windows that opened

### Port conflicts
Make sure ports 3005 (Next.js) and 3006 (WebSocket) are available.
