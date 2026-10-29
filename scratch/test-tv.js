const { execSync } = require('child_process');

try {
  execSync('powershell -NoProfile -Command "Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue"');
} catch (_) {}

console.log('Testing start videos: ...');
try {
  execSync('cmd.exe /c start videos:');
} catch (e) {
  console.log('Err:', e.message);
}

setTimeout(() => {
  const ps = `Get-Process | Where-Object { $_.ProcessName -like '*Apple*' } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Compress`;
  try {
    const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    console.log('Processes after "start videos:":', res);
  } catch (e) {
    console.log('None found:', e.message);
  }
}, 3000);
