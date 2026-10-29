$events = Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddMinutes(-30)} -ErrorAction SilentlyContinue | Where-Object { $_.Message -match "Apple" -or $_.ProviderName -match "Apple" }
Write-Output "Found $($events.Count) events:"
foreach ($e in $events | Select-Object -First 10) {
    Write-Output "[$($e.TimeCreated)] ($($e.LevelDisplayName)) $($e.ProviderName): $($e.Message)"
}
