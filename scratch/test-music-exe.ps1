Stop-Process -Name AppleMusic -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Testing start AppleMusic.exe directly ---"
cmd.exe /c start AppleMusic.exe
Start-Sleep -Seconds 3

$clean = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "After start AppleMusic.exe: PID=$($clean.Id), MainWindowHandle=$($clean.MainWindowHandle)"
