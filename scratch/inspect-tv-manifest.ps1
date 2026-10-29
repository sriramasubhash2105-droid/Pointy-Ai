$pkg = Get-AppxPackage -Name *AppleTV*
$manifestPath = (Join-Path $pkg.InstallLocation "AppxManifest.xml")
[xml]$manifest = Get-Content $manifestPath

Write-Output "=== Applications ==="
foreach ($app in $manifest.Package.Applications.Application) {
    Write-Output "App Id: $($app.Id), Executable: $($app.Executable), EntryPoint: $($app.EntryPoint)"
    foreach ($ext in $app.Extensions.Extension) {
        Write-Output "  Extension Category: $($ext.Category)"
        if ($ext.Protocol) {
            Write-Output "    Protocol Name: $($ext.Protocol.Name)"
            if ($ext.Protocol.DisplayName) { Write-Output "    Protocol DisplayName: $($ext.Protocol.DisplayName)" }
        }
    }
}
