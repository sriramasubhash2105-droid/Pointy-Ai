const { execSync } = require('child_process');

const ps = `Get-Process -Name ApplicationFrameHost | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Compress`;
try {
  const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
  console.log('ApplicationFrameHost windows:', res);
} catch (e) {
  console.log('Error checking ApplicationFrameHost:', e.message);
}
