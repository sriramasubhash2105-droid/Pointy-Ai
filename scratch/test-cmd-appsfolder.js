const { execSync } = require('child_process');

// 1. Kill any existing instances first
try {
  execSync('powershell -NoProfile -Command "Stop-Process -Name AppleMusic, AppleTV -Force -ErrorAction SilentlyContinue"');
} catch (_) {}

console.log('Testing start with shell:AppsFolder in cmd.exe...');
try {
  execSync('cmd.exe /c start "" "shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"');
  console.log('Fired Apple Music start command');
} catch (e) {
  console.log('Err start Music:', e.message);
}

setTimeout(() => {
  const ps = `Get-Process | Where-Object { $_.ProcessName -like '*Apple*' } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Compress`;
  try {
    const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    console.log('Processes after cmd start:', res);
  } catch (e) {
    console.log('None found:', e.message);
  }
}, 3000);
