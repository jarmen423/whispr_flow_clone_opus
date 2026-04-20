# install-cli.ps1
# Purpose: Install LocalFlow CLI command to your system PATH and configure API keys
# Dependencies: None (pure PowerShell)
# Role: One-stop setup script for new LocalFlow users
# Usage: .\scripts\install-cli.ps1
#

$ErrorActionPreference = "Stop"

# Colors
function Write-Color($Text, $Color) {
    Write-Host $Text -ForegroundColor $Color
}

Write-Color "=== LocalFlow CLI Installer ===" "Cyan"
Write-Host ""

# Determine install location
$LocalBin = "$env:USERPROFILE\.local\bin"
$CliName = "localflow.ps1"
$SourceScript = Join-Path $PSScriptRoot ".." "whispr-flow.ps1"
$TargetScript = Join-Path $LocalBin $CliName
$WrapperScript = Join-Path $LocalBin "localflow.cmd"
$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..") | Select-Object -ExpandProperty Path
$EnvPath = Join-Path $ProjectDir ".env"
$EnvExamplePath = Join-Path $ProjectDir ".env.example"

# Create .local\bin if it doesn't exist
if (-not (Test-Path $LocalBin)) {
    Write-Color "Creating $LocalBin..." "Yellow"
    New-Item -ItemType Directory -Path $LocalBin -Force | Out-Null
}

# Copy the main script
Write-Color "Installing localflow command..." "Green"
Copy-Item $SourceScript $TargetScript -Force

# Create a .cmd wrapper (so user can type just 'localflow' not 'localflow.ps1')
$WrapperContent = @'@echo off
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\.local\bin\localflow.ps1" %*
'@
Set-Content -Path $WrapperScript -Value $WrapperContent -Force

# Set LOCALFLOW_HOME environment variable to current project directory
$CurrentHome = [Environment]::GetEnvironmentVariable("LOCALFLOW_HOME", "User")

if ($CurrentHome -ne $ProjectDir) {
    Write-Color "Setting LOCALFLOW_HOME to: $ProjectDir" "Yellow"
    [Environment]::SetEnvironmentVariable("LOCALFLOW_HOME", $ProjectDir, "User")
    Write-Color "LOCALFLOW_HOME environment variable updated!" "Green"
} else {
    Write-Color "LOCALFLOW_HOME already set correctly" "Gray"
}

# Check if LocalBin is in PATH
$PathVar = [Environment]::GetEnvironmentVariable("Path", "User")
if ($PathVar -notlike "*$LocalBin*") {
    Write-Color "Adding $LocalBin to your PATH..." "Yellow"
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$PathVar;$LocalBin",
        "User"
    )
    Write-Color "PATH updated!" "Green"
} else {
    Write-Color "$LocalBin is already in PATH" "Gray"
}

# ============================================
# API KEY CONFIGURATION
# ============================================

Write-Host ""
Write-Color "─────────────────────────────────────────────" "Gray"
Write-Color "  API Key Configuration" "Cyan"
Write-Color "─────────────────────────────────────────────" "Gray"
Write-Host ""

# Ensure .env file exists
if (-not (Test-Path $EnvPath)) {
    if (Test-Path $EnvExamplePath) {
        Write-Color "Creating .env file from template..." "Yellow"
        Copy-Item $EnvExamplePath $EnvPath
    } else {
        Write-Color "Creating new .env file..." "Yellow"
        New-Item -ItemType File -Path $EnvPath -Force | Out-Null
    }
}

# Helper function to get current value from .env
function Get-EnvValue {
    param([string]$Key)
    $Content = Get-Content $EnvPath -ErrorAction SilentlyContinue
    foreach ($Line in $Content) {
        if ($Line -match "^$Key=(.+)$") {
            return $Matches[1]
        }
    }
    return $null
}

# Helper function to update .env value
function Set-EnvValue {
    param([string]$Key, [string]$Value)
    $Content = Get-Content $EnvPath -Raw -ErrorAction SilentlyContinue
    if (-not $Content) { $Content = "" }
    
    $Pattern = "(?m)^$Key=.*$"
    if ($Content -match $Pattern) {
        $Content = $Content -replace $Pattern, "$Key=$Value"
    } else {
        if ($Content -and -not $Content.EndsWith("`n")) { $Content += "`n" }
        $Content += "$Key=$Value`n"
    }
    Set-Content -Path $EnvPath -Value $Content -NoNewline
}

# Check current API key status
$GroqKey = Get-EnvValue -Key "GROQ_API_KEY"
$CerebrasKey = Get-EnvValue -Key "CEREBRAS_API_KEY"

$GroqConfigured = $GroqKey -and $GroqKey -notmatch "your_key|paste_here|xxx|^$"
$CerebrasConfigured = $CerebrasKey -and $CerebrasKey -notmatch "your_key|paste_here|xxx|^$"

# Show current status
Write-Host "Current API Key Status:"
if ($GroqConfigured) {
    $MaskedGroq = $GroqKey.Substring(0, [Math]::Min(10, $GroqKey.Length)) + "..."
    Write-Color "  [✓] Groq: $MaskedGroq" "Green"
} else {
    Write-Color "  [✗] Groq: NOT CONFIGURED (required)" "Red"
}

if ($CerebrasConfigured) {
    $MaskedCerebras = $CerebrasKey.Substring(0, [Math]::Min(10, $CerebrasKey.Length)) + "..."
    Write-Color "  [✓] Cerebras: $MaskedCerebras" "Green"
} else {
    Write-Color "  [○] Cerebras: NOT CONFIGURED (optional)" "Yellow"
}

Write-Host ""

# Prompt for Groq key if not configured
if (-not $GroqConfigured) {
    Write-Host "LocalFlow needs a Groq API key for speech-to-text transcription."
    Write-Host "Get your FREE key at:"
    Write-Color "  https://console.groq.com/keys" "Blue"
    Write-Host ""
    Write-Host "Steps: Create account → Create API Key → Copy the key"
    Write-Host ""
    
    $NewGroqKey = Read-Host "Paste your Groq API key here (or press Enter to skip)"
    $NewGroqKey = $NewGroqKey.Trim()
    
    if ($NewGroqKey) {
        Set-EnvValue -Key "GROQ_API_KEY" -Value $NewGroqKey
        Set-EnvValue -Key "PROCESSING_MODE" -Value "cloud"
        Write-Color "  ✓ Groq API key saved!" "Green"
    } else {
        Write-Color "  ⚠ Skipped - LocalFlow won't work until you add this key!" "Yellow"
        Write-Host "  Run .\scripts\setup-api-keys.ps1 later to configure."
    }
    Write-Host ""
}

# Prompt for Cerebras key if not configured
if (-not $CerebrasConfigured) {
    Write-Host "Cerebras API key enables smart formatting with Alt+M (lists, outlines)."
    Write-Host "Get your FREE key at:"
    Write-Color "  https://cloud.cerebras.ai/" "Blue"
    Write-Host ""
    
    $NewCerebrasKey = Read-Host "Paste your Cerebras API key here (or press Enter to skip)"
    $NewCerebrasKey = $NewCerebrasKey.Trim()
    
    if ($NewCerebrasKey) {
        Set-EnvValue -Key "CEREBRAS_API_KEY" -Value $NewCerebrasKey
        Write-Color "  ✓ Cerebras API key saved!" "Green"
    } else {
        Write-Color "  ○ Skipped (optional - Alt+M formatting won't work)" "Gray"
    }
    Write-Host ""
}

# ============================================
# FINAL STATUS
# ============================================

Write-Host ""
Write-Color "============================================" "Cyan"
Write-Color "  ✅ Installation Complete!" "Green"
Write-Color "============================================" "Cyan"
Write-Host ""

Write-Host "Usage:"
Write-Color "  localflow       " "Cyan" -NoNewline
Write-Host "- Start LocalFlow services"
Write-Color "  localflow -stop " "Cyan" -NoNewline
Write-Host "- Stop LocalFlow services"
Write-Host ""

Write-Host "Hotkeys (once running):"
Write-Host "  Alt+L  = Record and transcribe (raw mode)"
Write-Host "  Alt+M  = Record and format (lists, outlines)"
Write-Host "  Alt+T  = Toggle translation mode"
Write-Host ""

Write-Color "⚠ IMPORTANT: Restart your terminal before running 'localflow'" "Yellow"
Write-Host ""

# Check if keys are configured for final message
$FinalGroqKey = Get-EnvValue -Key "GROQ_API_KEY"
$FinalGroqConfigured = $FinalGroqKey -and $FinalGroqKey -notmatch "your_key|paste_here|xxx|^$"

if ($FinalGroqConfigured) {
    Write-Color "Ready to go! After restarting terminal, just type: localflow" "Green"
} else {
    Write-Color "⚠ Don't forget to add your Groq API key before using LocalFlow!" "Yellow"
    Write-Host "Run: .\scripts\setup-api-keys.ps1"
}
Write-Host ""
