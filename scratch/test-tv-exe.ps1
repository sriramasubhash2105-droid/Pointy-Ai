Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Testing start AppleTV.exe directly ---"
cmd.exe /c start AppleTV.exe
Start-Sleep -Seconds 3

$clean = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "After start AppleTV.exe: PID=$($clean.Id), MainWindowHandle=$($clean.MainWindowHandle)"
