Stop-Process -Name AppleMusic, AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "=== TEST 3: Launch Apple Music via protocol music: ==="
cmd.exe /c start music:
Start-Sleep -Seconds 4

$p = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "Apple Music Process: PID=$($p.Id), MainWindowTitle='$($p.MainWindowTitle)', MainWindowHandle=$($p.MainWindowHandle)"
