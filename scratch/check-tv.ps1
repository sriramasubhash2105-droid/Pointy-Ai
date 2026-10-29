$procs = Get-Process -Name AppleTV -ErrorAction SilentlyContinue
foreach ($p in $procs) {
    Write-Output "PID: $($p.Id), Responding: $($p.Responding), MainWindowHandle: $($p.MainWindowHandle)"
}

# Let's inspect AppxPackage
$pkg = Get-AppxPackage -Name *AppleTV*
Write-Output "Package: $($pkg.PackageFamilyName)"
$manifestPath = (Join-Path $pkg.InstallLocation "AppxManifest.xml")
[xml]$manifest = Get-Content $manifestPath
$protocols = $manifest.Package.Applications.Application.Extensions.Extension | Where-Object { $_.Category -eq 'windows.protocol' }
Write-Output "Protocols:"
foreach ($proto in $protocols) {
    Write-Output " - $($proto.Protocol.Name)"
}
