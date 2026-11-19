$ErrorActionPreference = 'Stop'

$ffmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpegCommand) {
    throw 'FFmpeg was not found. Install FFmpeg and make sure ffmpeg.exe is on PATH.'
}

$logDirectory = Join-Path $PSScriptRoot '..\.local\test-feeds'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

$feeds = @(
    @{ Path = 'cam-main'; Label = 'Main'; Frequency = 440; Hue = 0 },
    @{ Path = 'cam-behind-goal'; Label = 'BehindGoal'; Frequency = 550; Hue = 120 },
    @{ Path = 'cam-tactical'; Label = 'Tactical'; Frequency = 660; Hue = 240 }
)

$processes = foreach ($feed in $feeds) {
    $arguments = @(
        '-hide_banner', '-loglevel', 'warning', '-re',
        '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25',
        '-f', 'lavfi', '-i', "sine=frequency=$($feed.Frequency):sample_rate=48000",
        '-vf', "hue=h=$($feed.Hue):s=1",
        '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.1', '-preset', 'veryfast', '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p', '-g', '50', '-keyint_min', '50', '-bf', '0',
        '-c:a', 'aac', '-b:a', '96k', '-ar', '48000',
        '-rtsp_transport', 'tcp', '-f', 'rtsp',
        "rtsp://localhost:8554/$($feed.Path)"
    )

    $stdout = Join-Path $logDirectory "$($feed.Label).out.log"
    $stderr = Join-Path $logDirectory "$($feed.Label).err.log"
    $process = Start-Process -FilePath $ffmpegCommand.Source -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    [pscustomobject]@{ Label = $feed.Label; Path = $feed.Path; ProcessId = $process.Id }
}

$pidFile = Join-Path $logDirectory 'processes.json'
$processes | ConvertTo-Json | Set-Content -Encoding UTF8 $pidFile

Write-Host 'Started three generated camera feeds:' -ForegroundColor Green
$processes | Format-Table -AutoSize
Write-Host "Logs: $logDirectory"
Write-Host 'Open http://localhost:3000 and select the camera angles.'
Write-Host 'Stop them with: .\scripts\stop-test-feeds.ps1'
