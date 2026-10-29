$pkg = Get-AppxPackage -Name *AppleTV*
$manifestPath = (Join-Path $pkg.InstallLocation "AppxManifest.xml")
[xml]$manifest = Get-Content $manifestPath

foreach ($app in $manifest.Package.Applications.Application) {
    Write-Output "--- App Id: $($app.Id) ---"
    foreach ($ext in $app.Extensions.Extension) {
        if ($ext.Category -eq 'windows.appExecutionAlias') {
            Write-Output "AppExecutionAlias: $($ext.AppExecutionAlias.ExecutionAlias.Alias)"
        }
        if ($ext.Category -eq 'windows.appUriHandler') {
            Write-Output "AppUriHandler: $($ext.AppUriHandler.Host)"
        }
    }
}
