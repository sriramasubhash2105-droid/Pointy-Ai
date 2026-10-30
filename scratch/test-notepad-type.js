const { exec } = require('child_process');

function typeIntoApp(launchCmd, appTitle, text, pressEnter = false) {
  return new Promise((resolve) => {
    // 1. Launch or bring to front
    exec(launchCmd, { shell: 'cmd.exe' }, () => {
      // 2. Wait 1.2s for the window to be open and focused
      setTimeout(() => {
        const escaped = text.replace(/"/g, '`"');
        const psScript = `
$w = New-Object -ComObject WScript.Shell
$w.AppActivate("${appTitle}")
Start-Sleep -Milliseconds 400
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText("${escaped}")
$w.SendKeys('^v')
if (${pressEnter ? 1 : 0} -eq 1) {
  Start-Sleep -Milliseconds 200
  $w.SendKeys('{ENTER}')
}
Write-Output "TYPED_SUCCESS"
`;
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
        exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (err, stdout) => {
          resolve(stdout.trim());
        });
      }, 1200);
    });
  });
}

typeIntoApp('start notepad.exe', 'Notepad', 'Hello! Pointy AI typed this into Notepad automatically.\nIt works flawlessly!')
  .then(res => console.log('Result:', res))
  .catch(err => console.error('Err:', err));
