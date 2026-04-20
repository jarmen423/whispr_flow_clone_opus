# setup-api-keys.ps1
# Purpose: Interactive script to configure LocalFlow API keys
# Dependencies: None (pure PowerShell)
# Role: First-run configuration helper for non-technical users
# Usage: .\scripts\setup-api-keys.ps1
#

$ErrorActionPreference = "Stop"

# Colors helper
function Write-Color($Text, $Color) {
    Write-Host $Text -ForegroundColor $Color
}

function Write-Banner {
    Write-Host ""
    Write-Color "============================================" "Cyan"
    Write-Color "   LocalFlow API Key Setup Wizard" "Cyan"
    Write-Color "============================================" "Cyan"
    Write-Host ""
}

function Get-ProjectRoot {
    # Determine project root from script location
    $ScriptDir = Split-Path -Parent $MyInvocation.ScriptName
    $ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..") | Select-Object -ExpandProperty Path
    
    if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
        Write-Color "ERROR: Could not find LocalFlow project directory." "Red"
        Write-Color "Please run this script from the scripts/ folder inside LocalFlow." "Yellow"
        exit 1
    }
    
    return $ProjectRoot
}

function Ensure-EnvFile {
    param([string]$ProjectRoot)
    
    $EnvPath = Join-Path $ProjectRoot ".env"
    $EnvExamplePath = Join-Path $ProjectRoot ".env.example"
    
    if (-not (Test-Path $EnvPath)) {
        if (Test-Path $EnvExamplePath) {
            Write-Color "Creating .env file from template..." "Yellow"
            Copy-Item $EnvExamplePath $EnvPath
        } else {
            Write-Color "Creating new .env file..." "Yellow"
            New-Item -ItemType File -Path $EnvPath -Force | Out-Null
        }
    }
    
    return $EnvPath
}

function Update-EnvValue {
    param(
        [string]$EnvPath,
        [string]$Key,
        [string]$Value
    )
    
    $Content = Get-Content $EnvPath -Raw -ErrorAction SilentlyContinue
    if (-not $Content) { $Content = "" }
    
    # Check if key exists
    $Pattern = "(?m)^$Key=.*$"
    if ($Content -match $Pattern) {
        # Replace existing value
        $Content = $Content -replace $Pattern, "$Key=$Value"
    } else {
        # Add new key at end
        if ($Content -and -not $Content.EndsWith("`n")) {
            $Content += "`n"
        }
        $Content += "$Key=$Value`n"
    }
    
    Set-Content -Path $EnvPath -Value $Content -NoNewline
}

function Get-CurrentValue {
    param(
        [string]$EnvPath,
        [string]$Key
    )
    
    $Content = Get-Content $EnvPath -ErrorAction SilentlyContinue
    foreach ($Line in $Content) {
        if ($Line -match "^$Key=(.+)$") {
            return $Matches[1]
        }
    }
    return $null
}

function Show-KeyStatus {
    param(
        [string]$EnvPath
    )
    
    Write-Host ""
    Write-Color "Current API Key Status:" "White"
    Write-Host ""
    
    $GroqKey = Get-CurrentValue -EnvPath $EnvPath -Key "GROQ_API_KEY"
    $CerebrasKey = Get-CurrentValue -EnvPath $EnvPath -Key "CEREBRAS_API_KEY"
    
    if ($GroqKey -and $GroqKey -notmatch "your_key|paste_here|xxx") {
        $MaskedGroq = $GroqKey.Substring(0, [Math]::Min(8, $GroqKey.Length)) + "..." 
        Write-Color "  [✓] Groq API Key: $MaskedGroq (configured)" "Green"
    } else {
        Write-Color "  [✗] Groq API Key: NOT SET (required for transcription)" "Red"
    }
    
    if ($CerebrasKey -and $CerebrasKey -notmatch "your_key|paste_here|xxx") {
        $MaskedCerebras = $CerebrasKey.Substring(0, [Math]::Min(8, $CerebrasKey.Length)) + "..."
        Write-Color "  [✓] Cerebras API Key: $MaskedCerebras (configured)" "Green"
    } else {
        Write-Color "  [○] Cerebras API Key: NOT SET (optional, for Alt+M formatting)" "Yellow"
    }
    
    Write-Host ""
}

function Prompt-ForKey {
    param(
        [string]$KeyName,
        [string]$Description,
        [string]$SignupUrl,
        [string]$KeyPrefix,
        [bool]$Required = $true
    )
    
    Write-Host ""
    Write-Color "─────────────────────────────────────────────" "Gray"
    Write-Color "$KeyName" "Cyan"
    Write-Color $Description "White"
    Write-Host ""
    Write-Host "Get your free key at:"
    Write-Color "  $SignupUrl" "Blue"
    Write-Host ""
    
    if ($Required) {
        Write-Color "This key is REQUIRED for LocalFlow to work." "Yellow"
    } else {
        Write-Color "This key is OPTIONAL (skip by pressing Enter)." "Gray"
    }
    
    Write-Host ""
    $Key = Read-Host "Paste your $KeyName here"
    
    # Trim whitespace
    $Key = $Key.Trim()
    
    # Validate
    if ([string]::IsNullOrEmpty($Key)) {
        if ($Required) {
            Write-Color "WARNING: No key provided. LocalFlow won't work without this!" "Red"
        } else {
            Write-Color "Skipped (optional)" "Gray"
        }
        return $null
    }
    
    # Basic validation
    if ($KeyPrefix -and -not $Key.StartsWith($KeyPrefix)) {
        Write-Color "WARNING: Key doesn't start with '$KeyPrefix'. Make sure you copied the full key!" "Yellow"
    }
    
    Write-Color "Key saved!" "Green"
    return $Key
}

# Main execution
Write-Banner

$ProjectRoot = Get-ProjectRoot
Write-Color "Project found at: $ProjectRoot" "Gray"

$EnvPath = Ensure-EnvFile -ProjectRoot $ProjectRoot

# Show current status
Show-KeyStatus -EnvPath $EnvPath

Write-Host ""
Write-Color "Let's set up your API keys!" "White"
Write-Host "You'll need to sign up for free accounts to get these keys."
Write-Host "(The free tiers are very generous - most users never pay anything)"
Write-Host ""

# Groq API Key
$GroqKey = Prompt-ForKey `
    -KeyName "Groq API Key" `
    -Description "Used for speech-to-text transcription (Whisper)" `
    -SignupUrl "https://console.groq.com/keys" `
    -KeyPrefix "gsk_" `
    -Required $true

if ($GroqKey) {
    Update-EnvValue -EnvPath $EnvPath -Key "GROQ_API_KEY" -Value $GroqKey
    # Also set processing mode to cloud
    Update-EnvValue -EnvPath $EnvPath -Key "PROCESSING_MODE" -Value "cloud"
}

# Cerebras API Key
$CerebrasKey = Prompt-ForKey `
    -KeyName "Cerebras API Key" `
    -Description "Used for smart formatting with Alt+M (lists, outlines, etc.)" `
    -SignupUrl "https://cloud.cerebras.ai/" `
    -KeyPrefix "csk-" `
    -Required $false

if ($CerebrasKey) {
    Update-EnvValue -EnvPath $EnvPath -Key "CEREBRAS_API_KEY" -Value $CerebrasKey
}

# Show final status
Write-Host ""
Write-Color "============================================" "Cyan"
Write-Color "   Setup Complete!" "Green"
Write-Color "============================================" "Cyan"

Show-KeyStatus -EnvPath $EnvPath

Write-Host ""
Write-Color "Next steps:" "White"
Write-Host "1. Run the CLI installer (if you haven't already):"
Write-Color "   .\scripts\install-cli.ps1" "Cyan"
Write-Host ""
Write-Host "2. Start LocalFlow:"
Write-Color "   localflow" "Cyan"
Write-Host ""
Write-Host "3. Use the hotkeys:"
Write-Host "   Alt+L = Record and transcribe (raw)"
Write-Host "   Alt+M = Record and format (lists, outlines)"
Write-Host "   Alt+T = Toggle translation mode"
Write-Host ""
Write-Color "Enjoy dictating! 🎤" "Green"
Write-Host ""
