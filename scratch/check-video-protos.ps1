$apps = Get-AppxPackage
foreach ($a in $apps) {
    $manifestPath = (Join-Path $a.InstallLocation "AppxManifest.xml")
    if (Test-Path $manifestPath) {
        try {
            [xml]$xml = Get-Content $manifestPath -ErrorAction SilentlyContinue
            $protos = $xml.Package.Applications.Application.Extensions.Extension | Where-Object { $_.Category -eq 'windows.protocol' }
            foreach ($p in $protos) {
                if ($p.Protocol.Name -eq 'videos' -or $p.Protocol.Name -eq 'video' -or $p.Protocol.Name -eq 'mswindowsvideo') {
                    Write-Output "Package $($a.Name) registers protocol: $($p.Protocol.Name)"
                }
            }
        } catch {}
    }
}
