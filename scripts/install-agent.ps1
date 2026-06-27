#Requires -Version 5.1
<#
.SYNOPSIS
    LocalFlow Desktop Agent Installer for Windows.

.DESCRIPTION
    Installs the LocalFlow desktop agent with global hotkey support.
    Clones the repository and installs the agent as a uv-managed tool, which
    provides the `localflow-agent` and `localflow-recover` console commands.
    Also creates Start Menu shortcuts for both.

    Requires uv (https://astral.sh/uv). If uv is missing it is installed
    automatically.

.EXAMPLE
    # Run directly from the web:
    # irm https://dictate.agentmemorylabs.com/api/download?platform=windows | iex

    # Or run locally:
    .\install-agent.ps1
#>

$ErrorActionPreference = "Stop"

# Configuration
$RepoUrl = "https://github.com/jarmen423/whispr_flow_clone_opus.git"
$InstallDir = "$env:USERPROFILE\.localflow\localflow"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)  { Write-Host "   + $msg" -ForegroundColor Green }
function Write-Warn($msg){ Write-Host "   ! $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  LocalFlow Desktop Agent Installer" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Check Git ---
Write-Step "Checking for Git..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Git is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Git from https://git-scm.com/download/win"
    exit 1
}
Write-Ok "Found Git"

# --- Ensure uv is installed ---
Write-Step "Checking for uv..."
$UvCmd = Get-Command uv -ErrorAction SilentlyContinue
if (-not $UvCmd) {
    Write-Warn "uv not found. Installing uv..."
    try {
        $installScript = (Invoke-WebRequest -Uri "https://astral.sh/uv/install.ps1" -UseBasicParsing -TimeoutSec 30).Content
        & powershell -ExecutionPolicy Bypass -Command $installScript
        # Refresh PATH for this session so `uv` resolves immediately.
        $env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";" + [Environment]::GetEnvironmentVariable("Path", "Machine")
        $UvCmd = Get-Command uv -ErrorAction SilentlyContinue
    } catch {
        Write-Host "ERROR: Could not install uv automatically." -ForegroundColor Red
        Write-Host "Please install uv manually: https://docs.astral.sh/uv/getting-started/installation/"
        exit 1
    }
}
if (-not $UvCmd) {
    Write-Host "ERROR: uv is still not on PATH. Open a new terminal and re-run, or install manually:" -ForegroundColor Red
    Write-Host "  https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
}
$UvVersion = & uv --version 2>&1
Write-Ok "Found $UvVersion"

# --- Clone or update repo ---
Write-Step "Downloading LocalFlow agent..."
if (Test-Path $InstallDir) {
    Write-Warn "Existing installation found at $InstallDir"
    Write-Warn "Updating..."
    Set-Location $InstallDir
    git pull --quiet
} else {
    New-Item -ItemType Directory -Path (Split-Path $InstallDir) -Force | Out-Null
    git clone --depth 1 $RepoUrl $InstallDir --quiet
}
Set-Location $InstallDir
Write-Ok "Agent files ready at $InstallDir"

# --- Install the agent as a uv tool (editable so `git pull` updates it) ---
Write-Step "Installing agent via uv (this may take a minute on first run)..."
uv tool install --editable --force .
Write-Ok "Agent installed"

# Refresh PATH so the new console scripts resolve in this session.
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -and ($UserPath -notlike "*$env:USERPROFILE\.local\bin*")) {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$env:USERPROFILE\.local\bin", "User")
    $env:Path = "$env:Path;$env:USERPROFILE\.local\bin"
}

# Locate the uv-installed console scripts so the shortcuts point at them.
$AgentExe = (Get-Command localflow-agent -ErrorAction SilentlyContinue).Source
$RecoverExe = (Get-Command localflow-recover -ErrorAction SilentlyContinue).Source
if (-not $AgentExe) {
    # Fall back to the uv bin directory directly.
    $UvBin = & uv tool dir 2>$null
    if ($UvBin) { $AgentExe = Join-Path $UvBin "localflow-agent.exe" }
}
Write-Ok "Console command: localflow-agent"
Write-Ok "Console command: localflow-recover"

# --- Create Start Menu shortcuts ---
Write-Step "Creating Start Menu shortcuts..."
$WshShell = New-Object -ComObject WScript.Shell
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\LocalFlow"
if (-not (Test-Path $StartMenuDir)) {
    New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
}

if ($AgentExe -and (Test-Path $AgentExe)) {
    $Shortcut = $WshShell.CreateShortcut("$StartMenuDir\LocalFlow Agent.lnk")
    $Shortcut.TargetPath = $AgentExe
    $Shortcut.WorkingDirectory = "$env:USERPROFILE"
    $Shortcut.Save()
}

if ($RecoverExe -and (Test-Path $RecoverExe)) {
    $RecoverShortcut = $WshShell.CreateShortcut("$StartMenuDir\LocalFlow Recovery.lnk")
    $RecoverShortcut.TargetPath = $RecoverExe
    $RecoverShortcut.WorkingDirectory = "$env:USERPROFILE"
    $RecoverShortcut.Save()
}
Write-Ok "Start Menu shortcuts created"

# --- Anonymous install ping (no PII, fails silently) ---
try {
    Invoke-RestMethod -Uri "https://dictate.agentmemorylabs.com/api/install-ping?platform=windows" -Method GET -TimeoutSec 5 | Out-Null
} catch {
    # Silently ignore ping failures
}

# --- Summary ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Start the agent:"
Write-Host "  localflow-agent           (after restarting terminal)" -ForegroundColor Cyan
Write-Host "Or find it in your Start Menu: LocalFlow > LocalFlow Agent" -ForegroundColor Cyan
Write-Host ""
Write-Host "Hotkeys (hold to record, release to paste):"
Write-Host "  Alt+L  - Raw dictation" -ForegroundColor Gray
Write-Host "  Alt+M  - AI formatting (outlines, lists)" -ForegroundColor Gray
Write-Host "  Alt+T  - Translate mode (speak any language -> English)" -ForegroundColor Gray
Write-Host "  Alt+A  - Voice agent (ask a question, web-search grounded answer)" -ForegroundColor Gray
Write-Host "  Alt+.  - Toggle dictation (press once to start, again to stop)" -ForegroundColor Gray
Write-Host "  Alt+J  - Format selected text" -ForegroundColor Gray
Write-Host "  Alt+N  - Cleanup selected text" -ForegroundColor Gray
Write-Host ""
Write-Host "Failed transcription recovery:"
Write-Host "  Open the Recovery Console:  localflow-recover" -ForegroundColor Cyan
Write-Host "    (or Start Menu: LocalFlow > LocalFlow Recovery)" -ForegroundColor Gray
Write-Host "  List saved recordings:      localflow-agent --list-failed-recordings" -ForegroundColor Gray
Write-Host "  Retry the newest:           localflow-agent --retry-latest-failed" -ForegroundColor Gray
Write-Host "  Saved recordings folder:    $env:USERPROFILE\.localflow\failed-recordings" -ForegroundColor Gray
Write-Host "  Default retention: 72 hours" -ForegroundColor Gray
Write-Host ""
Write-Host "Updates:"
Write-Host "  cd $InstallDir ; git pull ; uv tool install --editable --force ." -ForegroundColor Gray
Write-Host ""
Write-Warn "On first run, enter your Groq API key if prompted."
Write-Host ""
