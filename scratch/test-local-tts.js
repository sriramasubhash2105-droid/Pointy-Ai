const { exec } = require('child_process');

function synthesizeLocalWav(text) {
  return new Promise((resolve, reject) => {
    const escaped = text.replace(/"/g, '`"');
    const psScript = `
Add-Type -AssemblyName System.Speech;
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female);
$ms = New-Object System.IO.MemoryStream;
$s.SetOutputToWaveStream($ms);
$s.Speak("${escaped}");
$bytes = $ms.ToArray();
$s.Dispose();
$ms.Dispose();
[Convert]::ToBase64String($bytes);
`;

    // Encode as UTF-16LE for PowerShell -EncodedCommand
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

    exec(`powershell -NoProfile -EncodedCommand ${encoded}`, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      const base64 = stdout.trim();
      resolve(base64);
    });
  });
}

async function test() {
  const start = Date.now();
  console.log('Testing synthesizeLocalWav with -EncodedCommand...');
  const base64 = await synthesizeLocalWav("Opening Apple Music for you!");
  console.log(`✅ Success in ${Date.now() - start}ms! Base64 length: ${base64.length}`);
}

test();
