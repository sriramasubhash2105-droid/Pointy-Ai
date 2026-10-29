$appsDir = "$env:LOCALAPPDATA\Microsoft\WindowsApps"
Write-Output "AppleTV.exe exists: $(Test-Path "$appsDir\AppleTV.exe")"
Write-Output "AppleMusic.exe exists: $(Test-Path "$appsDir\AppleMusic.exe")"

# Let's inspect AppUriHandler details
$pkg = Get-AppxPackage -Name *AppleTV*
$manifestPath = (Join-Path $pkg.InstallLocation "AppxManifest.xml")
[xml]$manifest = Get-Content $manifestPath
$uriHandlers = $manifest.Package.Applications.Application.Extensions.Extension | Where-Object { $_.Category -eq 'windows.appUriHandler' }
Write-Output "AppUriHandler XML:"
$uriHandlers.InnerXml
