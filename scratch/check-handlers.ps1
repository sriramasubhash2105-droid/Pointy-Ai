$musicHandler = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\music\UserChoice" -ErrorAction SilentlyContinue
$videoHandler = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\videos\UserChoice" -ErrorAction SilentlyContinue

Write-Output "Music handler: $($musicHandler.ProgId)"
Write-Output "Video handler: $($videoHandler.ProgId)"
