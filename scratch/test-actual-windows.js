const { execSync } = require('child_process');

// 1. Kill any existing instances first
try {
  execSync('powershell -NoProfile -Command "Stop-Process -Name AppleMusic, AppleTV -Force -ErrorAction SilentlyContinue"');
} catch (_) {}

console.log('Testing start music: ...');
try {
  execSync('cmd.exe /c start music:');
} catch (e) {
  console.log('Err start music:', e.message);
}

setTimeout(() => {
  const ps = `Get-Process | Where-Object { $_.ProcessName -like '*Apple*' } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Compress`;
  try {
    const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    console.log('Processes after "start music:":', res);
  } catch (e) {
    console.log('None found:', e.message);
  }

  // Next, test shell:AppsFolder for Apple TV
  console.log('\nTesting start shell:AppsFolder for Apple TV...');
  try {
    execSync('cmd.exe /c start "" "shell:AppsFolder\\AppleInc.AppleTVWin_nzyj5cx40ttqa!App"');
  } catch (e) {
    console.log('Err start TV:', e.message);
  }

  setTimeout(() => {
    try {
      const res2 = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
      console.log('Processes after Apple TV start:', res2);
    } catch (e) {
      console.log('None found:', e.message);
    }
  }, 3000);

}, 3000);
