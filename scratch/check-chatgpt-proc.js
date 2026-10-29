const { execSync } = require('child_process');

try {
  const ps = `Get-Process | Where-Object { $_.ProcessName -like '*ChatGPT*' -or $_.ProcessName -like '*OpenAI*' -or $_.ProcessName -like '*Codex*' } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Compress`;
  const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
  console.log('Running ChatGPT processes:', res);
} catch (e) {
  console.error('Err:', e.message);
}
