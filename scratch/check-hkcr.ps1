Write-Output "HKCR\music:"
Get-ItemProperty -Path "Registry::HKEY_CLASSES_ROOT\music\shell\open\command" -ErrorAction SilentlyContinue | Format-List

Write-Output "HKCR\videos:"
Get-ItemProperty -Path "Registry::HKEY_CLASSES_ROOT\videos\shell\open\command" -ErrorAction SilentlyContinue | Format-List
