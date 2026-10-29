$p = Get-Process -Id 56120 -ErrorAction SilentlyContinue
if ($p) {
    Write-Output "PID 56120 exists. Handles: $($p.Handles), WorkingSet: $($p.WorkingSet64)"
    try {
        $p.Kill()
        Write-Output "p.Kill() called"
    } catch {
        Write-Output "Kill error: $_"
    }
} else {
    Write-Output "PID 56120 does not exist"
}
