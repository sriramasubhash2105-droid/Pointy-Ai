# Kill existing Apple processes
Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "=== Launching AppleTV.exe directly ==="
$exe = "$env:LOCALAPPDATA\Microsoft\WindowsApps\AppleTV.exe"
Start-Process $exe
Start-Sleep -Seconds 4

$tv = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "Apple TV Process: PID=$($tv.Id), MainWindowTitle='$($tv.MainWindowTitle)', MainWindowHandle=$($tv.MainWindowHandle)"
