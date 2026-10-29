$procs = Get-Process
$withWindows = foreach ($p in $procs) {
    if ($p.MainWindowHandle -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
        [PSCustomObject]@{
            Id = $p.Id
            Name = $p.ProcessName
            Title = $p.MainWindowTitle
        }
    }
}
$withWindows | Out-String -Width 160
