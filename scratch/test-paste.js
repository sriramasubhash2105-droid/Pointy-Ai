const { exec } = require('child_process');

function typeText(text, pressEnter = false) {
  return new Promise((resolve, reject) => {
    const escaped = text.replace(/"/g, '`"');
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText("${escaped}")
$w = New-Object -ComObject WScript.Shell
$w.SendKeys('^v')
${pressEnter ? "$w.SendKeys('{ENTER}')" : ''}
Write-Output "TYPED_OK"
`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

typeText('Pointy AI Auto-Type Test')
  .then(res => console.log('Success:', res))
  .catch(err => console.error('Error:', err));
