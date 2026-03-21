# whispr-flow-debug.ps1
# Debug startup - all service logs visible in this terminal
# Usage: whispr-flow-debug (from anywhere after profile is updated)

param()

$ScriptPath = $MyInvocation.MyCommand.Path
$ScriptDir = Split-Path -Parent $ScriptPath

# Find project root (same logic as whispr-flow.ps1)
if (Test-Path (Join-Path $ScriptDir "package.json")) {
    $ProjectRoot = $ScriptDir
} elseif (Test-Path (Join-Path $ScriptDir ".." "package.json")) {
    $ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..") | Select-Object -ExpandProperty Path
} else {
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
        Write-Error "Could not find LocalFlow project directory. Set LOCALFLOW_HOME or run from project root."
        exit 1
    }
}

# Binaries - use .cmd wrappers (most reliable on Windows without bun)
$VenvPython   = "$ProjectRoot\agent\.venv-whispr\Scripts\python.exe"
$Concurrently = "$ProjectRoot\node_modules\.bin\concurrently.cmd"
$Next         = "$ProjectRoot\node_modules\.bin\next.cmd"
$SucraseNode  = "$ProjectRoot\node_modules\.bin\sucrase-node.cmd"
$WsService    = "$ProjectRoot\mini-services\websocket-service\index.ts"
$Agent        = "$ProjectRoot\agent\localflow-agent.py"

# Validate
if (-not (Test-Path $VenvPython)) {
    Write-Error "Python venv not found: $VenvPython"
    Write-Error "Run: cd '$ProjectRoot\agent' && python -m venv .venv-whispr && pip install -r requirements.txt"
    exit 1
}
if (-not (Test-Path $Concurrently)) {
    Write-Error "concurrently not found. Run: npm install"
    exit 1
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "   LocalFlow  DEBUG MODE" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  [nextjs]    Next.js on :3005" -ForegroundColor Cyan
Write-Host "  [websocket] WS service on :3002" -ForegroundColor Green
Write-Host "  [agent]     Python desktop agent" -ForegroundColor Yellow
Write-Host ""

# Kill anything holding our ports (node, bun, or otherwise)
Write-Host "Clearing ports 3002 and 3005..." -ForegroundColor Gray
foreach ($port in @(3002, 3005)) {
    $lines = cmd /c "netstat -ano" 2>$null | Select-String ":$port\s" | Select-String "LISTENING"
    foreach ($line in $lines) {
        $procId = ($line.ToString().Trim() -split '\s+')[-1]
        if ($procId -match '^\d+$' -and $procId -ne '0') {
            Write-Host "  Killing PID $procId on port $port" -ForegroundColor Gray
            Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Milliseconds 800

Write-Host "Ctrl+C stops all services." -ForegroundColor Gray
Write-Host ""

Set-Location $ProjectRoot

& $Concurrently `
    "--names"         "nextjs,websocket,agent" `
    "--prefix-colors" "cyan.bold,green.bold,yellow.bold" `
    "--kill-others" `
    "$Next dev -p 3005" `
    "$SucraseNode `"$WsService`"" `
    "`"$VenvPython`" -u `"$Agent`""
