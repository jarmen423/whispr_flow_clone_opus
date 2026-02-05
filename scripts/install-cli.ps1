# install-cli.ps1
# Install LocalFlow CLI command to your system PATH
# Run: .\scripts\install-cli.ps1

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
$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..") | Select-Object -ExpandProperty Path
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
    Write-Color "PATH updated! You may need to restart your terminal." "Yellow"
} else {
    Write-Color "$LocalBin is already in PATH" "Gray"
}

Write-Host ""
Write-Color "✅ Installation complete!" "Green"
Write-Host ""
Write-Host "Usage:"
Write-Host "  localflow       - Start LocalFlow services"
Write-Host "  localflow -stop - Stop LocalFlow services"
Write-Host ""
Write-Color "Note: Restart your terminal or run 'refreshenv' to use the command immediately." "Yellow"
