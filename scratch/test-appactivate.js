const { exec } = require('child_process');

function focusAndType(targetAppTitle, textToType, pressEnter = false) {
  return new Promise((resolve, reject) => {
    const escaped = textToType.replace(/"/g, '`"');
    const psScript = `
$w = New-Object -ComObject WScript.Shell
$activated = $w.AppActivate("${targetAppTitle}")
Start-Sleep -Milliseconds 400
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText("${escaped}")
$w.SendKeys('^v')
if (${pressEnter ? 1 : 0} -eq 1) {
  Start-Sleep -Milliseconds 250
  $w.SendKeys('{ENTER}')
}
Write-Output "ACTIVATED: $activated"
`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

focusAndType('Pointy AI', 'Test')
  .then(res => console.log('Result:', res))
  .catch(err => console.error('Err:', err));
