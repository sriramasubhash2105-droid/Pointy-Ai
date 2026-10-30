$voice = New-Object -ComObject SAPI.SpVoice
Write-Output "Voice count: $($voice.GetVoices().Count)"
foreach ($v in $voice.GetVoices()) {
    Write-Output " - $($v.GetDescription())"
}
