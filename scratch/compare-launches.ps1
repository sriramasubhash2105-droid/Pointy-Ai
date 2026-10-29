# Kill any existing Apple processes first
Stop-Process -Name AppleMusic, AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Testing 1: cmd.exe /c start music: ONLY ---"
cmd.exe /c start music:
Start-Sleep -Seconds 3

$p = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "AppleMusic with start music: PID=$($p.Id), MainWindowHandle=$($p.MainWindowHandle)"

# Kill it
Stop-Process -Name AppleMusic -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Testing 2: cmd.exe /c start """" ""shell:AppsFolder\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"" ---"
cmd.exe /c start "" "shell:AppsFolder\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"
Start-Sleep -Seconds 3

$p2 = Get-Process -Name AppleMusic -ErrorAction SilentlyContinue
Write-Output "AppleMusic with shell:AppsFolder: PID=$($p2.Id), MainWindowHandle=$($p2.MainWindowHandle)"
