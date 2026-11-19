$ErrorActionPreference = 'Continue'
$pidFile = Join-Path $PSScriptRoot '..\.local\test-feeds\processes.json'

if (-not (Test-Path $pidFile)) {
    Write-Host 'No saved test-feed process list found.'
    exit 0
}

$processes = Get-Content $pidFile -Raw | ConvertFrom-Json
foreach ($item in $processes) {
    $process = Get-Process -Id ([int]$item.ProcessId) -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq 'ffmpeg') {
        Stop-Process -Id $process.Id -Force
        Write-Host "Stopped $($item.Label) (PID $($item.ProcessId))"
    }
}
Remove-Item $pidFile -Force
