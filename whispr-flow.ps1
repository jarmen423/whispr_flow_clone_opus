# whispr-flow.ps1
# Universal startup script for LocalFlow (Windows PowerShell)
# Usage: ./whispr-flow.ps1 [-stop]
#
# This script can be:
# 1. Run directly from the project root
# 2. Installed to PATH via: .\scripts\install-cli.ps1
# 3. Then run from anywhere as: localflow [-stop]

param(
    [switch]$stop,
    [switch]$formatSelection,
    [switch]$chooseFormat,
    [ValidateSet("markdown", "json", "jsonl", "csv")]
    [string]$formatTarget = "markdown"
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

    function Stop-LocalFlowProcess {
        <#
        .SYNOPSIS
        Stops one LocalFlow-owned process and keeps shutdown best-effort.

        .DESCRIPTION
        LocalFlow runs as several child processes, but Windows machines often
        also have unrelated node.exe processes in service sessions. This helper
        stops only a caller-selected PID and converts permission failures into
        warnings so `whispr-flow -stop` does not fail while touching unrelated
        elevated services.

        .PARAMETER ProcessId
        Windows process ID to stop.

        .PARAMETER Reason
        Short operator-facing explanation of why this PID was selected.
        #>
        param(
            [Parameter(Mandatory = $true)]
            [int]$ProcessId,

            [Parameter(Mandatory = $true)]
            [string]$Reason
        )

        try {
            $Process = Get-Process -Id $ProcessId -ErrorAction Stop
            Write-Host "  Stopping $($Process.ProcessName) ($ProcessId) - $Reason" -ForegroundColor Gray
            Stop-Process -Id $ProcessId -Force -ErrorAction Stop
        } catch {
            $Message = $_.Exception.Message
            Write-Warning "Could not stop PID $ProcessId ($Reason): $Message"

            if ($Message -like "*Access is denied*") {
                Write-Warning "PID $ProcessId is probably running from an elevated/admin session. Run whispr-flow -stop from Administrator PowerShell or close the elevated LocalFlow window."
            }
        }
    }

    function Stop-LocalFlowPortListeners {
        <#
        .SYNOPSIS
        Stops processes listening on LocalFlow's development ports.

        .DESCRIPTION
        The local stack exposes the Next.js app on port 3000 and the Socket.IO
        bridge on port 3002. Matching by port is more precise than killing all
        Node.js processes and still works when the command line is hidden from a
        non-elevated PowerShell session.

        .PARAMETER Ports
        TCP ports that belong to the LocalFlow development stack.
        #>
        param(
            [Parameter(Mandatory = $true)]
            [int[]]$Ports
        )

        $NetstatOutput = cmd /c "netstat -ano -p tcp" 2>$null

        foreach ($Port in $Ports) {
            $MatchingLines = $NetstatOutput |
                Select-String ":$Port\s" |
                Select-String "LISTENING"

            foreach ($Line in $MatchingLines) {
                $ProcessIdText = ($Line.ToString().Trim() -split '\s+')[-1]
                if ($ProcessIdText -match '^\d+$' -and $ProcessIdText -ne '0') {
                    Stop-LocalFlowProcess -ProcessId ([int]$ProcessIdText) -Reason "listener on port $Port"
                }
            }
        }
    }

    function Stop-LocalFlowCommandProcesses {
        <#
        .SYNOPSIS
        Stops LocalFlow processes that can be identified by command line.

        .DESCRIPTION
        Some LocalFlow processes do not have stable ports, especially the Python
        desktop agent. CIM exposes command lines for normal user-session
        processes, allowing this script to target project-owned Node/Bun/Python
        work without touching unrelated developer tools or Windows services.

        .PARAMETER ProjectRoot
        Absolute LocalFlow repository path used to recognize project-owned
        command lines.
        #>
        param(
            [Parameter(Mandatory = $true)]
            [string]$ProjectRoot
        )

        $ProcessQuery = "name = 'node.exe' or name = 'bun.exe' or name = 'python.exe' or name = 'python3.exe'"
        $KnownFragments = @(
            $ProjectRoot,
            "localflow-agent.py",
            "mini-services\websocket-service",
            "mini-services/websocket-service",
            "scripts\dev.js",
            "scripts/dev.js"
        )

        Get-CimInstance Win32_Process -Filter $ProcessQuery -ErrorAction SilentlyContinue |
            Where-Object {
                $CommandLine = $_.CommandLine
                if (-not $CommandLine) {
                    return $false
                }

                foreach ($Fragment in $KnownFragments) {
                    if ($CommandLine.IndexOf($Fragment, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                        return $true
                    }
                }

                return $false
            } |
            ForEach-Object {
                Stop-LocalFlowProcess -ProcessId ([int]$_.ProcessId) -Reason "LocalFlow command line"
            }
    }

    Stop-LocalFlowPortListeners -Ports @(3000, 3002)
    Stop-LocalFlowCommandProcesses -ProjectRoot $ProjectRoot

    Write-Host "Stopped!" -ForegroundColor Red
} elseif ($formatSelection) {
    Write-Host "Formatting selected text with LocalFlow..." -ForegroundColor Cyan

    if (-not (Test-Path $VenvActivate)) {
        Write-Error "Virtual environment not found at: $VenvActivate"
        exit 1
    }

    $formatArgs = @("--format-selection", "--format-target", $formatTarget)
    if ($chooseFormat) {
        $formatArgs += "--choose-format"
    }

    $agentCommand = "cd '$ProjectRoot/agent'; & '$VenvActivate'; python localflow-agent.py $($formatArgs -join ' ')"
    powershell -Command $agentCommand
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
