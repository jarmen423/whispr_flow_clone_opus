# whispr-flow.ps1
# Universal startup script for LocalFlow (Windows PowerShell)
# Usage: ./whispr-flow.ps1 [-stop]
#
# This script can be:
# 1. Run directly from the project root
# 2. Installed to PATH via: .\scripts\install-cli.ps1
# 3. Then run from anywhere as: localflow [-stop]

param(
    [switch]$stop
)

# Determine project root
# If running from installed location, we need to find where LocalFlow is installed
$ScriptPath = $MyInvocation.MyCommand.Path
$ScriptDir = Split-Path -Parent $ScriptPath

# Check if we're running from the project root (script next to package.json)
if (Test-Path (Join-Path $ScriptDir "package.json")) {
    $ProjectRoot = $ScriptDir
} elseif (Test-Path (Join-Path $ScriptDir ".." "package.json")) {
    # Running from scripts/ subdirectory
    $ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..") | Select-Object -ExpandProperty Path
} else {
    # Not in project - check common locations or use environment variable
    $PossiblePaths = @(
        $env:LOCALFLOW_HOME,
        "$env:USERPROFILE\localflow",
        "$env:USERPROFILE\LocalFlow",
        "$env:USERPROFILE\whispr_flow_clones\opus"
    )
    
    $ProjectRoot = $null
    foreach ($Path in $PossiblePaths) {
        if ($Path -and (Test-Path (Join-Path $Path "package.json"))) {
            $ProjectRoot = $Path
            break
        }
    }
    
    if (-not $ProjectRoot) {
        Write-Error "Could not find LocalFlow project directory."
        Write-Error "Please set LOCALFLOW_HOME environment variable to your project root."
        Write-Error "Or run this script from the project directory."
        exit 1
    }
}

# Determine virtual environment activation script based on OS
if ($IsWindows -or ($env:OS -match "Windows")) {
    $VenvActivate = "$ProjectRoot/agent/.venv-whispr/Scripts/Activate.ps1"
} else {
    $VenvActivate = "$ProjectRoot/agent/.venv-whispr/bin/Activate.ps1"
}

if ($stop) {
    Write-Host "Stopping LocalFlow services..." -ForegroundColor Yellow
    
    # Stop Node.js processes (Next.js and WebSocket service)
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    
    # Stop Python agent processes
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { 
        $_.CommandLine -like "*localflow-agent*" 
    } | Stop-Process -Force
    
    # Also try python3 on Linux/macOS
    Get-Process -Name "python3" -ErrorAction SilentlyContinue | Where-Object { 
        $_.CommandLine -like "*localflow-agent*" 
    } | Stop-Process -Force
    
    Write-Host "Stopped!" -ForegroundColor Red
} else {
    Write-Host "Starting LocalFlow services..." -ForegroundColor Cyan
    Write-Host "Project root: $ProjectRoot" -ForegroundColor Gray
    
    # Check if virtual environment exists
    if (-not (Test-Path $VenvActivate)) {
        Write-Error "Virtual environment not found at: $VenvActivate"
        Write-Error "Please run: cd '$ProjectRoot/agent' && python -m venv .venv-whispr && pip install -r requirements.txt"
        exit 1
    }
    
    # Check if npm dependencies are installed
    if (-not (Test-Path "$ProjectRoot/node_modules")) {
        Write-Warning "node_modules not found. Running npm install..."
        Set-Location $ProjectRoot
        npm install
    }
    
    # Start Web UI and WebSocket service
    Write-Host "Starting Web UI and WebSocket service..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-Command", "cd '$ProjectRoot'; npm run dev:all" -WindowStyle Hidden
    
    # Start Desktop Agent
    Write-Host "Starting Desktop Agent..." -ForegroundColor Green
    $AgentCommand = "cd '$ProjectRoot/agent'; & '$VenvActivate'; python localflow-agent.py"
    Start-Process powershell -ArgumentList "-Command", $AgentCommand -WindowStyle Hidden
    
    Write-Host "Services started!" -ForegroundColor Green
    Write-Host "Press Alt+L for Raw mode, Alt+M for Format mode" -ForegroundColor Cyan
}
