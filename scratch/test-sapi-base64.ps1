$text = "Opening Apple Music for you!"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)

$ms = New-Object System.IO.MemoryStream
$synth.SetOutputToWaveStream($ms)
$synth.Speak($text)
$bytes = $ms.ToArray()
$base64 = [Convert]::ToBase64String($bytes)
$sw.Stop()

Write-Output "Synthesized $($bytes.Length) bytes (Base64 length: $($base64.Length)) in $($sw.ElapsedMilliseconds)ms"
