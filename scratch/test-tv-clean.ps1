Write-Output "=== Launching Apple TV clean ==="
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace('shell:AppsFolder')
$item = $folder.ParseName('AppleInc.AppleTVWin_nzyj5cx40ttqa!App')
$item.InvokeVerb('open')

Start-Sleep -Seconds 4

$tv = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
Write-Output "Apple TV Process: PID=$($tv.Id), MainWindowTitle='$($tv.MainWindowTitle)', MainWindowHandle=$($tv.MainWindowHandle)"
