# Spawn a ghost process
cmd.exe /c start "" "shell:AppsFolder\AppleInc.AppleTVWin_nzyj5cx40ttqa!App"
Start-Sleep -Seconds 2

$ghost = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "Ghost AppleTV: PID=$($ghost.Id), MainWindowHandle=$($ghost.MainWindowHandle)"

# Now test what happens if we call start videos: while ghost is running:
cmd.exe /c start videos:
Start-Sleep -Seconds 2
$after = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "After start videos: PID=$($after.Id), MainWindowHandle=$($after.MainWindowHandle)"

# Now kill and restart with start videos:
Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
cmd.exe /c start videos:
Start-Sleep -Seconds 2
$clean = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "After clean start videos: PID=$($clean.Id), MainWindowHandle=$($clean.MainWindowHandle)"
