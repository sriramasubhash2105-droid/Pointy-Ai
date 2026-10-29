const { execSync } = require('child_process');

console.log('Testing unified Apple launch in scratch...');

// 1. Kill any existing instances first
try {
  execSync('powershell -NoProfile -Command "Stop-Process -Name AppleMusic, AppleTV -Force -ErrorAction SilentlyContinue"');
} catch (_) {}

function launchApple(appId, protocol) {
  const { exec } = require('child_process');
  exec(`start "" "shell:AppsFolder\\${appId}"`, { shell: 'cmd.exe' });
  if (protocol) {
    setTimeout(() => {
      exec(`start ${protocol}`, { shell: 'cmd.exe' });
    }, 300);
  }
}

launchApple('AppleInc.AppleMusicWin_nzyj5cx40ttqa!App', 'music:');
launchApple('AppleInc.AppleTVWin_nzyj5cx40ttqa!App', null);

setTimeout(() => {
  const ps = `Get-Process | Where-Object { $_.ProcessName -like '*Apple*' } | Select-Object Id, ProcessName | ConvertTo-Json -Compress`;
  try {
    const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    console.log('Running Apple Processes:', res);
  } catch (e) {
    console.log('None found:', e.message);
  }
}, 3000);
