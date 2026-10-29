$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace('shell:AppsFolder')
foreach ($item in $folder.Items()) {
    if ($item.Name -eq 'Apple Music' -or $item.Name -eq 'Apple TV') {
        Write-Output ("Found: " + $item.Name + " (" + $item.Path + ")")
        $item.InvokeVerb('open')
        Write-Output ("Opened: " + $item.Name)
    }
}
