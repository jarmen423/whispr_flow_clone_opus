<#
.SYNOPSIS
    Master Startup Script for LocalFlow Development Environment.

.DESCRIPTION
    This script automates the startup of all required services for the LocalFlow
    dictation system development environment. It orchestrates multiple components
    based on the configured PROCESSING_MODE in the .env file.
    
    The script performs the following operations:
    
    1. **Environment Analysis**: Reads PROCESSING_MODE from .env to determine
       which services need to be started.
    
    2. **Prerequisite Verification**: Checks that required tools (Windows Terminal,
       npm, SSH for networked-local mode) are installed and available.
    
    3. **Service Orchestration**: Launches services in separate Windows Terminal tabs:
       - Node.js Development Servers (Always): Next.js dev server (port 3005)
         and WebSocket service, started via "npm run dev:all"
       - Python LocalFlow Agent (Always): Desktop agent for hotkey detection,
         activated from .venv-whispr virtual environment
       - Remote LLM Audio Server (networked-local mode only): LFM2.5-Audio server
         accessed via SSH to josh@100.111.169.60 (configurable)

    Processing Modes:
        - 'cloud': Uses Groq API for processing - NO local LLM server needed
        - 'networked-local': Uses remote Whisper/LLM servers - STARTS LLM server via SSH
        - 'local': Uses local binaries - NO remote LLM server needed

    Dependencies:
        - Node.js with npm/bun installed and available in PATH
        - Python virtual environment at agent/.venv-whispr
        - Windows Terminal (wt.exe) for spawning terminal windows
        - SSH client (only required for networked-local mode)
        - SSH access to remote machine (100.111.169.60 by default)

    Role in Codebase:
        This is the primary entry point for developers to launch the full
        LocalFlow stack with a single command. It eliminates the need to manually
        open multiple terminals and run separate startup commands for each service.
        
        The script is called by:
        - Developers during daily development (primary use case)
        - Can be integrated into IDE run configurations

    Key Technologies/APIs:
        - PowerShell parameter validation and help documentation
        - Get-Content: Reading .env file content
        - Select-String/regex: Parsing PROCESSING_MODE from environment file
        - Get-Command: Checking for prerequisite tool availability
        - Start-Process: Launching Windows Terminal with specific commands
        - Windows Terminal CLI (wt.exe): Tab management and command execution
        - SSH: Remote server access for networked-local mode

    Configuration:
        All configurable values are defined in the CONFIGURATION SECTION below.
        Remote host, ports, and model paths can be customized as needed.

    Exit Codes:
        0: Success - All services started
        1: Failure - Missing prerequisites or configuration error

.NOTES
    File Name      : start-all.ps1
    Author         : LocalFlow Development Team
    Created        : 2026-01-29
    Version        : 1.0.0
    
    CONFIGURATION:
    - Processing Mode: Read from .env file (PROCESSING_MODE variable)
    - Remote SSH host: josh@100.111.169.60 (see $RemoteHost variable)
    - LLM Server Port: 8888
    - Next.js Dev Port: 3005
    - WebSocket Port: Configured in mini-services/websocket-service

    IMPORTANT:
    - Ensure .env file exists in project root before running
    - Windows Terminal must be installed from Microsoft Store
    - For networked-local mode, SSH key must be configured for passwordless auth

.EXAMPLE
    .\scripts\start-all.ps1
    
    Launches services based on PROCESSING_MODE in .env file.
    Output shows startup progress and service locations.

.EXAMPLE
    .\scripts\start-all.ps1 -Verbose
    
    (Future enhancement) Could support verbose logging of startup steps.

.LINK
    Project Documentation: ../SETUP_GUIDE.md
    WebSocket Service: ../mini-services/websocket-service/index.ts
    Python Agent: ../agent/localflow-agent.py
#>

# ============================================================================
# CONFIGURATION SECTION
# ============================================================================
# Modify these variables to customize service locations and settings
# ============================================================================

<#
    Project root directory calculation.
    
    Resolves to the parent directory of the scripts folder where this
    file is located. Used as the base for all relative paths.
    
    Example: If script is at D:\Projects\opus\scripts\start-all.ps1
             $ProjectRoot becomes D:\Projects\opus
#>
$ProjectRoot = Split-Path -Parent $PSScriptRoot

<#
    Remote server configuration for LFM2.5-Audio LLM server.
    
    These settings control the SSH connection to the remote machine
    running the multimodal audio LLM for networked-local mode.
    
    Fields:
        $RemoteHost: SSH connection string (user@hostname or user@IP)
        $RemoteLLMPort: Port the LLM server will listen on
        $RemoteHostIP: IP address for the --host parameter
    
    Security Note: Assumes SSH key authentication is configured
#>
$RemoteHost = "josh@100.111.169.60"  # <--- REPLACE WITH YOUR SSH HOST IF DIFFERENT
$RemoteLLMPort = "8888"
$RemoteHostIP = "100.111.169.60"

<#
    LFM2.5-Audio model file paths on the remote server.
    
    These paths are relative to the remote user's home directory.
    The model files must exist on the remote machine before starting.
    
    Files Required:
        - LFM2.5-Audio-1.5B-Q4_0.gguf: Main model weights
        - mmproj-LFM2.5-Audio-1.5B-Q4_0.gguf: Multimodal projection
        - vocoder-LFM2.5-Audio-1.5B-Q4_0.gguf: Audio vocoder
        - tokenizer-LFM2.5-Audio-1.5B-Q4_0.gguf: Text tokenizer
#>
$LLMModelFile = "LFM2.5-Audio-1.5B-Q4_0.gguf"
$LLMMMProjFile = "mmproj-LFM2.5-Audio-1.5B-Q4_0.gguf"
$LLMVocoderFile = "vocoder-LFM2.5-Audio-1.5B-Q4_0.gguf"
$LLMSpeakerFile = "tokenizer-LFM2.5-Audio-1.5B-Q4_0.gguf"

# ============================================================================
# READ PROCESSING MODE FROM .ENV FILE
# ============================================================================
# Determines which services need to be started based on configuration
# ============================================================================

<#
    Environment file path and processing mode variable initialization.
    
    The script attempts to read PROCESSING_MODE from the .env file.
    If the file doesn't exist or doesn't contain the variable,
    defaults to "cloud" mode (safest default as it requires no local setup).
#>
$EnvFilePath = Join-Path $ProjectRoot ".env"
$ProcessingMode = "cloud"  # Default fallback

<#
    Parse .env file to extract PROCESSING_MODE.
    
    Reads the file line by line, looking for the pattern:
    PROCESSING_MODE=value
    
    Skips comments (lines starting with #) and empty lines.
    Handles quoted values by trimming quotes.
#>
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

<#
.SYNOPSIS
    Writes colored output to the console for better visibility.

.DESCRIPTION
    Utility function to display startup status messages with color coding.
    Green indicates success/starting, Yellow for warnings/in-progress,
    Red for errors.

    Using a centralized function ensures consistent output formatting
    and makes it easy to add logging or output redirection later.

.PARAMETER Message
    The message string to display. Can include formatting characters.

.PARAMETER Color
    The console color to use for this message.
    Valid values: Black, DarkBlue, DarkGreen, DarkCyan, DarkRed, DarkMagenta,
    DarkYellow, Gray, DarkGray, Blue, Green, Cyan, Red, Magenta, Yellow, White
    Default: Green

.EXAMPLE
    Write-ColoredOutput "Starting service..." -Color Yellow
    Write-ColoredOutput "Service started!" -Color Green

.OUTPUTS
    None. Writes directly to the console host.
#>
function Write-ColoredOutput {
    param(
        [Parameter(Mandatory=$true, Position=0)]
        [string]$Message,
        
        [Parameter()]
        [ConsoleColor]$Color = [ConsoleColor]::Green
    )
    
    Write-Host $Message -ForegroundColor $Color
}

<#
.SYNOPSIS
    Checks if a command/executable is available in PATH.

.DESCRIPTION
    Validates that required tools (npm, python, ssh, wt) are installed
    and accessible before attempting to start services. This prevents
    confusing errors later by catching missing prerequisites early.

    Uses Get-Command with SilentlyContinue error action to avoid
    throwing errors when commands are not found.

.PARAMETER Command
    The command name to check for availability (e.g., "npm", "ssh")

.RETURNS
    [bool] $true if command exists in PATH, $false otherwise

.EXAMPLE
    if (-not (Test-CommandExists "npm")) {
        Write-Error "npm is required but not found"
    }

.NOTES
    This is a simple wrapper that returns a boolean. For scripts that
    need detailed information about the command, use Get-Command directly.
#>
function Test-CommandExists {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Command
    )
    
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# ============================================================================
# STARTUP BANNER
# ============================================================================
# Display startup information and configuration summary
# ============================================================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       LocalFlow Development Environment Launcher           " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-ColoredOutput "Project Root: $ProjectRoot"
Write-ColoredOutput "Processing Mode: $ProcessingMode" -Color Magenta
Write-Host ""

# Determine step count based on mode for progress indication
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
# Verify all required tools are installed before attempting startup
# ============================================================================

Write-ColoredOutput "[1/$TotalSteps] Checking prerequisites..." -Color Yellow

# Check for Windows Terminal - Required for spawning service tabs
if (-not (Test-CommandExists "wt")) {
    Write-ColoredOutput "ERROR: Windows Terminal (wt.exe) not found!" -Color Red
    Write-ColoredOutput "Please install Windows Terminal from the Microsoft Store." -Color Red
    exit 1
}

# Check for npm - Required for running Node.js services
if (-not (Test-CommandExists "npm")) {
    Write-ColoredOutput "ERROR: npm not found in PATH!" -Color Red
    Write-ColoredOutput "Please install Node.js from https://nodejs.org/" -Color Red
    exit 1
}

# Check for ssh (only required for networked-local mode)
if ($NeedsRemoteLLM) {
    if (-not (Test-CommandExists "ssh")) {
        Write-ColoredOutput "ERROR: ssh not found in PATH!" -Color Red
        Write-ColoredOutput "SSH is required for networked-local mode." -Color Red
        Write-ColoredOutput "Enable OpenSSH client in Windows Settings or install Git for Windows." -Color Red
        exit 1
    }
    Write-ColoredOutput "SSH client found - ready for remote LLM connection" -Color Green
}

Write-ColoredOutput "All prerequisites satisfied!" -Color Green
Write-Host ""

# ============================================================================
# SERVICE STARTUP
# ============================================================================
# Launch services in separate Windows Terminal tabs
# ============================================================================

# --- Service 1: Node.js Dev Servers (Next.js + WebSocket) ---
Write-ColoredOutput "[2/$TotalSteps] Starting Node.js development servers..." -Color Yellow
Write-ColoredOutput "      Running: npm run dev:all" -Color Gray
Write-ColoredOutput "      Next.js: http://localhost:3005" -Color Gray

<#
    Construct and launch Node.js services command.
    
    Commands executed:
    1. cd to project root
    2. npm run dev:all (starts both Next.js and WebSocket)
    3. Read-Host to keep window open after process exits
    
    Windows Terminal Arguments:
    - new-tab: Create new tab
    - --title: Set tab title
    - pwsh: Use PowerShell as shell
    - -NoExit: Keep shell open after command
    - -Command: Execute the specified command string
#>
$NodeCommand = "cd `"$ProjectRoot`"; npm run dev:all; Read-Host 'Press Enter to close'"
Start-Process wt -ArgumentList "new-tab", "--title", "LocalFlow - Dev Servers", "pwsh", "-NoExit", "-Command", $NodeCommand

Start-Sleep -Seconds 2

# --- Service 2: Python LocalFlow Agent ---
Write-ColoredOutput "[3/$TotalSteps] Starting Python LocalFlow Agent..." -Color Yellow
Write-ColoredOutput "      Activating venv: .venv-whispr" -Color Gray
Write-ColoredOutput "      Script: localflow-agent.py" -Color Gray

<#
    Construct and launch Python agent command.
    
    Commands executed:
    1. cd to agent directory
    2. Activate virtual environment
    3. Run localflow-agent.py
    4. Read-Host to keep window open
    
    The virtual environment activation ensures the agent has access
    to all required Python packages (pynput, sounddevice, etc.)
#>
$PythonVenvPath = Join-Path $ProjectRoot "agent\.venv-whispr\Scripts\Activate.ps1"
$PythonScriptPath = Join-Path $ProjectRoot "agent\localflow-agent.py"

$PythonCommand = "cd `"$ProjectRoot\agent`"; & `"$PythonVenvPath`"; python `"$PythonScriptPath`"; Read-Host 'Press Enter to close'"
Start-Process wt -ArgumentList "new-tab", "--title", "LocalFlow - Python Agent", "pwsh", "-NoExit", "-Command", $PythonCommand

Start-Sleep -Seconds 2

# --- Service 3: Remote LFM2.5-Audio LLM Server via SSH (networked-local mode only) ---
if ($NeedsRemoteLLM) {
    Write-ColoredOutput "[4/$TotalSteps] Starting remote LFM2.5-Audio LLM server via SSH..." -Color Yellow
    Write-ColoredOutput "      Host: $RemoteHost" -Color Gray
    Write-ColoredOutput "      Port: $RemoteLLMPort" -Color Gray

    <#
        Build the remote command for the llama.cpp audio server.
        
        The LFM2.5-Audio server requires multiple model files:
        - -m: Main model weights
        - -mm: Multimodal projection model
        - -mv: Vocoder for audio generation
        - --tts-speaker-file: Tokenizer for text processing
        
        Command is executed via SSH on the remote host.
    #>
    $RemoteLLMCommand = @"
./runner/llama-liquid-audio-server -m $LLMModelFile -mm $LLMMMProjFile -mv $LLMVocoderFile --tts-speaker-file $LLMSpeakerFile --host $RemoteHostIP --port $RemoteLLMPort
"@

    # SSH into remote machine and start the LLM server
    $SSHCommand = "ssh $RemoteHost `"$RemoteLLMCommand`"; Read-Host 'Press Enter to close'"
    Start-Process wt -ArgumentList "new-tab", "--title", "LocalFlow - LLM Server (Remote)", "pwsh", "-NoExit", "-Command", $SSHCommand
}

# ============================================================================
# COMPLETION MESSAGE
# ============================================================================
# Display summary of started services and next steps
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
Write-ColoredOutput "Access the web UI at: http://localhost:3005" -Color Green
Write-Host ""

<#
    End of script - services are now running in separate tabs.
    This PowerShell process will exit while the spawned services continue running.
#>
