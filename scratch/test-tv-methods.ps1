Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Testing TV 1: cmd.exe /c start videos: ---"
cmd.exe /c start videos:
Start-Sleep -Seconds 3
$tv1 = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "AppleTV with start videos: PID=$($tv1.Id), MainWindowHandle=$($tv1.MainWindowHandle)"
Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Testing TV 2: AppExecutionAlias start AppleTV.exe ---"
cmd.exe /c start AppleTV.exe
Start-Sleep -Seconds 3
$tv2 = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "AppleTV with start AppleTV.exe: PID=$($tv2.Id), MainWindowHandle=$($tv2.MainWindowHandle)"
Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Testing TV 3: COM Shell InvokeVerb('open') ---"
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace('shell:AppsFolder')
$item = $folder.ParseName('AppleInc.AppleTVWin_nzyj5cx40ttqa!App')
$item.InvokeVerb('open')
Start-Sleep -Seconds 3
$tv3 = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "AppleTV with COM open: PID=$($tv3.Id), MainWindowHandle=$($tv3.MainWindowHandle)"
Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Output "--- Testing TV 4: AppURI start https://tv.apple.com ---"
cmd.exe /c start https://tv.apple.com
Start-Sleep -Seconds 3
$tv4 = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "AppleTV with https://tv.apple.com: PID=$($tv4.Id), MainWindowHandle=$($tv4.MainWindowHandle)"
