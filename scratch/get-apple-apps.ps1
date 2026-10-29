$apps = Get-StartApps | Where-Object { $_.Name -like "*Apple*" }
foreach ($a in $apps) {
    Write-Output "StartApp: $($a.Name) => $($a.AppID)"
}
