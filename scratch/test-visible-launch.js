const { execSync } = require('child_process');

console.log('Testing launch with visible window...');

// Launch Apple Music using URI
try {
  execSync('cmd.exe /c start applemusic:');
  console.log('Executed start applemusic:');
} catch (e) {
  console.error('Err:', e.message);
}

// Wait 2.5 seconds and check MainWindowHandle
setTimeout(() => {
  const ps = `Get-Process | Where-Object { $_.ProcessName -like '*Apple*' } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Compress`;
  try {
    const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    console.log('After URI launch procs:', res);
  } catch (e) {
    console.log('None found:', e.message);
  }
}, 2500);
