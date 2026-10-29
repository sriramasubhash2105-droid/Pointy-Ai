const { execSync } = require('child_process');

console.log('Testing launch visibility...');

// Check if AppleMusic is already running in background
const checkProcs = () => {
  const ps = `Get-Process | Where-Object { $_.ProcessName -like '*Apple*' } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Compress`;
  try {
    const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
    console.log('Apple Procs:', res);
  } catch (e) {
    console.log('None found');
  }
};

checkProcs();
