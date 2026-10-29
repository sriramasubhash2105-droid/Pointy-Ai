Stop-Process -Name AppleMusic, AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Launching clean start music: and start videos: ---"
cmd.exe /c start music:
cmd.exe /c start videos:
Start-Sleep -Seconds 4

$procs = Get-Process -Name AppleMusic, AppleTV -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowHandle, MainWindowTitle
$procs | Format-Table -AutoSize
