<#
.SYNOPSIS
    Master Startup Script for WhisprFlow Development Environment.

.DESCRIPTION
    This script automates the startup of all required services for the WhisprFlow
    development environment. It orchestrates up to three main components based on
    the configured PROCESSING_MODE in .env:
    
    1. **Node.js Development Servers** (Always): Starts the Next.js dev server
       (port 3005) and WebSocket service concurrently using `npm run dev:all`.
    
    2. **Python LocalFlow Agent** (Always): Activates the Python virtual environment
       (.venv-whispr) and launches the localflow-agent.py script, which handles
       hotkey detection, audio recording, and communication with the web interface.
    
    3. **Remote LLM Audio Server** (networked-local mode only): Establishes an SSH
       connection to a secondary machine (josh@100.111.169.60) and starts the
       LFM2.5-Audio llama.cpp server for audio processing capabilities.

    Processing Modes:
        - 'cloud': Uses Groq API for processing - NO local LLM server needed
        - 'networked-local': Uses remote Whisper/LLM servers - STARTS LLM server via SSH
        - 'local': Uses local binaries - NO remote LLM server needed

    Dependencies:
        - Node.js with npm/bun installed
        - Python virtual environment at agent/.venv-whispr
        - SSH access to remote machine (100.111.169.60) - only for networked-local mode
        - Windows Terminal (wt.exe) for spawning terminal windows

    Role in Codebase:
        This is the primary entry point for developers to launch the full
        WhisprFlow stack with a single command. It replaces the need to manually
        open multiple terminals and run separate commands.

.NOTES
    Author: WhisprFlow Development Team
    Created: 2026-01-29
    
    CONFIGURATION:
    - Processing Mode: Read from .env file (PROCESSING_MODE)
    - Remote SSH host: josh@100.111.169.60
    - LLM Server Port: 8888
    - Next.js Dev Port: 3005
    - WebSocket Port: (configured in mini-services/websocket-service)

.EXAMPLE
    .\scripts\start-all.ps1
    
    Launches services based on PROCESSING_MODE in .env file.
#>

# ============================================================================
# CONFIGURATION SECTION
# ============================================================================

# Project root directory (parent of scripts folder)
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# Remote server configuration for LFM2.5-Audio LLM server
$RemoteHost = "josh@100.111.169.60"  # <--- REPLACE WITH YOUR SSH HOST IF DIFFERENT
$RemoteLLMPort = "8888"
$RemoteHostIP = "100.111.169.60"

# LFM2.5-Audio model file paths (relative to remote home directory)
$LLMModelFile = "LFM2.5-Audio-1.5B-Q4_0.gguf"
$LLMMMProjFile = "mmproj-LFM2.5-Audio-1.5B-Q4_0.gguf"
$LLMVocoderFile = "vocoder-LFM2.5-Audio-1.5B-Q4_0.gguf"
$LLMSpeakerFile = "tokenizer-LFM2.5-Audio-1.5B-Q4_0.gguf"

# ============================================================================
# READ PROCESSING MODE FROM .ENV FILE
# ============================================================================

$EnvFilePath = Join-Path $ProjectRoot ".env"
$ProcessingMode = "cloud"  # Default fallback

if (Test-Path $EnvFilePath) {
    $EnvContent = Get-Content $EnvFilePath
    foreach ($line in $EnvContent) {
        # Match PROCESSING_MODE=value (skip comments and empty lines)
        if ($line -match "^\s*PROCESSING_MODE\s*=\s*(.+)\s*$") {
            $ProcessingMode = $Matches[1].Trim().Trim('"').Trim("'")
            break
        }
    }
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-ColoredOutput {
    <#
    .SYNOPSIS
        Writes colored output to the console for better visibility.
    
    .DESCRIPTION
        Utility function to display startup status messages with color coding.
        Green indicates success/starting, Yellow for warnings, Red for errors.

    .PARAMETER Message
        The message string to display.

    .PARAMETER Color
        The console color to use (default: Green).
    #>
    param(
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::Green
    )
    
    Write-Host $Message -ForegroundColor $Color
}

function Test-CommandExists {
    <#
    .SYNOPSIS
        Checks if a command/executable is available in PATH.

    .DESCRIPTION
        Validates that required tools (npm, python, ssh, wt) are installed
        and accessible before attempting to start services.

    .PARAMETER Command
        The command name to check for availability.

    .RETURNS
        Boolean indicating whether the command exists.
    #>
    param([string]$Command)
    
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# ============================================================================
# STARTUP BANNER
# ============================================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       WhisprFlow Development Environment Launcher          " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-ColoredOutput "Project Root: $ProjectRoot"
Write-ColoredOutput "Processing Mode: $ProcessingMode" -Color Magenta
Write-Host ""

# Determine step count based on mode
$NeedsRemoteLLM = $ProcessingMode -eq "networked-local"
if ($NeedsRemoteLLM) {
    $TotalSteps = 4
    Write-ColoredOutput "Mode 'networked-local' detected - will start remote LLM server" -Color Gray
} else {
    $TotalSteps = 3
    Write-ColoredOutput "Mode '$ProcessingMode' detected - remote LLM server not needed" -Color Gray
}
Write-Host ""

# ============================================================================
# PREREQUISITE CHECKS
# ============================================================================

Write-ColoredOutput "[1/$TotalSteps] Checking prerequisites..." -Color Yellow

# Check for Windows Terminal
if (-not (Test-CommandExists "wt")) {
    Write-ColoredOutput "ERROR: Windows Terminal (wt.exe) not found!" -Color Red
    Write-ColoredOutput "Please install Windows Terminal from the Microsoft Store." -Color Red
    exit 1
}

# Check for npm/bun
if (-not (Test-CommandExists "npm")) {
    Write-ColoredOutput "ERROR: npm not found in PATH!" -Color Red
    exit 1
}

# Check for ssh (only required for networked-local mode)
if ($NeedsRemoteLLM) {
    if (-not (Test-CommandExists "ssh")) {
        Write-ColoredOutput "ERROR: ssh not found in PATH!" -Color Red
        exit 1
    }
}

Write-ColoredOutput "All prerequisites satisfied!" -Color Green
Write-Host ""

# ============================================================================
# SERVICE STARTUP
# ============================================================================

# --- Service 1: Node.js Dev Servers (Next.js + WebSocket) ---
Write-ColoredOutput "[2/$TotalSteps] Starting Node.js development servers..." -Color Yellow
Write-ColoredOutput "      Running: npm run dev:all" -Color Gray
Write-ColoredOutput "      Next.js: http://localhost:3005" -Color Gray

$NodeCommand = "cd `"$ProjectRoot`"; npm run dev:all; Read-Host 'Press Enter to close'"
Start-Process wt -ArgumentList "new-tab", "--title", "WhisprFlow - Dev Servers", "pwsh", "-NoExit", "-Command", $NodeCommand

Start-Sleep -Seconds 2

# --- Service 2: Python LocalFlow Agent ---
Write-ColoredOutput "[3/$TotalSteps] Starting Python LocalFlow Agent..." -Color Yellow
Write-ColoredOutput "      Activating venv: .venv-whispr" -Color Gray
Write-ColoredOutput "      Script: localflow-agent.py" -Color Gray

$PythonVenvPath = Join-Path $ProjectRoot "agent\.venv-whispr\Scripts\Activate.ps1"
$PythonScriptPath = Join-Path $ProjectRoot "agent\localflow-agent.py"

$PythonCommand = "cd `"$ProjectRoot\agent`"; & `"$PythonVenvPath`"; python `"$PythonScriptPath`"; Read-Host 'Press Enter to close'"
Start-Process wt -ArgumentList "new-tab", "--title", "WhisprFlow - Python Agent", "pwsh", "-NoExit", "-Command", $PythonCommand

Start-Sleep -Seconds 2

# --- Service 3: Remote LFM2.5-Audio LLM Server via SSH (networked-local mode only) ---
if ($NeedsRemoteLLM) {
    Write-ColoredOutput "[4/$TotalSteps] Starting remote LFM2.5-Audio LLM server via SSH..." -Color Yellow
    Write-ColoredOutput "      Host: $RemoteHost" -Color Gray
    Write-ColoredOutput "      Port: $RemoteLLMPort" -Color Gray

    # Build the remote command for the llama.cpp audio server
    $RemoteLLMCommand = @"
./runner/llama-liquid-audio-server -m $LLMModelFile -mm $LLMMMProjFile -mv $LLMVocoderFile --tts-speaker-file $LLMSpeakerFile --host $RemoteHostIP --port $RemoteLLMPort
"@

    # SSH into remote machine and start the LLM server
    $SSHCommand = "ssh $RemoteHost `"$RemoteLLMCommand`"; Read-Host 'Press Enter to close'"
    Start-Process wt -ArgumentList "new-tab", "--title", "WhisprFlow - LLM Server (Remote)", "pwsh", "-NoExit", "-Command", $SSHCommand
}

# ============================================================================
# COMPLETION MESSAGE
# ============================================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "       All services started in Windows Terminal tabs!       " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-ColoredOutput "Processing Mode: $ProcessingMode" -Color Magenta
Write-Host ""
Write-ColoredOutput "Services running:"
Write-ColoredOutput "  [TAB 1] Node.js Dev Servers (Next.js + WebSocket)" -Color Cyan
Write-ColoredOutput "  [TAB 2] Python LocalFlow Agent" -Color Cyan
if ($NeedsRemoteLLM) {
    Write-ColoredOutput "  [TAB 3] Remote LFM2.5-Audio LLM Server" -Color Cyan
} else {
    Write-ColoredOutput "  [SKIP]  Remote LLM Server (not needed for '$ProcessingMode' mode)" -Color DarkGray
}
Write-Host ""
Write-ColoredOutput "To stop all services, close the Windows Terminal tabs." -Color Yellow
Write-Host ""

