Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)
$filePath = Join-Path $PSScriptRoot "speech-sample.wav"
$synth.SetOutputToWaveFile($filePath)
$synth.Speak("open notepad and write hello world")
$synth.Dispose()
Write-Output "Generated speech-sample.wav"
