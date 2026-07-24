# ULTRON Desktop Launcher
param(
    [int]$Port = 3456,
    [string]$ApiKey = ""
)

$exe = Join-Path $PSScriptRoot "..\dist\ultron.exe"
if (-not (Test-Path $exe)) {
    $exe = Join-Path $PSScriptRoot "..\dist\index.js"
    $args = @("run", $exe, "--web", "--port", $Port)
    $proc = Start-Process "bun" -ArgumentList $args -PassThru -NoNewWindow
} else {
    $args = @("--web", "--port", $Port)
    if ($ApiKey) { $args += "--api-key", $ApiKey }
    $proc = Start-Process $exe -ArgumentList $args -PassThru -NoNewWindow
}

Write-Host "Waiting for ULTRON to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

$url = "http://127.0.0.1:$Port"

# Try Edge first (app mode), fallback to default browser
$edge = Get-Command msedge -ErrorAction SilentlyContinue
if ($edge) {
    Start-Process msedge -ArgumentList "--app=$url", "--new-window", "--window-size=1200,800"
} else {
    Start-Process $url
}

Write-Host "ULTRON Desktop running at $url" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor DarkGray

try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    if ($proc -and !$proc.HasExited) {
        $proc.Kill()
        Write-Host "ULTRON stopped." -ForegroundColor Yellow
    }
}
