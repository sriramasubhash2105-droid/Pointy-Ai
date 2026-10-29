# Spawn a ghost process by calling shell:AppsFolder
cmd.exe /c start "" "shell:AppsFolder\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"
Start-Sleep -Seconds 2

$ghost = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "Ghost AppleMusic: PID=$($ghost.Id), MainWindowHandle=$($ghost.MainWindowHandle)"

# Now test what happens if we call start music: while ghost is running:
cmd.exe /c start music:
Start-Sleep -Seconds 2
$after = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "After start music: PID=$($after.Id), MainWindowHandle=$($after.MainWindowHandle)"

# Now kill and restart with start music:
Stop-Process -Name AppleMusic -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
cmd.exe /c start music:
Start-Sleep -Seconds 2
$clean = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "After clean start music: PID=$($clean.Id), MainWindowHandle=$($clean.MainWindowHandle)"
