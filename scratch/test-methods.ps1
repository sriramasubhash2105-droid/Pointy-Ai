# First kill existing Apple processes
Stop-Process -Name AppleMusic, AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "=== TEST 1: Launch Apple Music via explorer shell:AppsFolder ==="
Start-Process "explorer.exe" -ArgumentList "shell:AppsFolder\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"
Start-Sleep -Seconds 3

$p = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "Apple Music Process: PID=$($p.Id), MainWindowTitle='$($p.MainWindowTitle)', MainWindowHandle=$($p.MainWindowHandle)"

# Now test Apple TV
Write-Output "=== TEST 2: Launch Apple TV via explorer shell:AppsFolder ==="
Start-Process "explorer.exe" -ArgumentList "shell:AppsFolder\AppleInc.AppleTVWin_nzyj5cx40ttqa!App"
Start-Sleep -Seconds 3

$tv = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "Apple TV Process: PID=$($tv.Id), MainWindowTitle='$($tv.MainWindowTitle)', MainWindowHandle=$($tv.MainWindowHandle)"
