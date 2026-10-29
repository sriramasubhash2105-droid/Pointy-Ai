const { exec, execSync } = require('child_process');

console.log('--- Killing existing Apple processes ---');
try {
  execSync('powershell -Command "Stop-Process -Name AppleMusic, AppleTV -Force -ErrorAction SilentlyContinue"');
} catch (e) {}

console.log('--- Checking protocols ---');
// Let's test launching Apple Music via protocol 'music:'
console.log('Testing start music: ...');
exec('start music:', { shell: 'cmd.exe' }, (err) => {
  if (err) console.error('music: err', err);
  else console.log('music: started');
});

// Let's test launching Apple TV via protocol 'videos:' or COM
console.log('Testing Apple TV launch ...');
const psTv = `powershell -NoProfile -Command "$s=New-Object -ComObject Shell.Application; $s.NameSpace('shell:AppsFolder').ParseName('AppleInc.AppleTVWin_nzyj5cx40ttqa!App').InvokeVerb('open')"`;
exec(psTv, { shell: 'cmd.exe' }, (err) => {
  if (err) console.error('tv err', err);
  else console.log('tv started');
});

setTimeout(() => {
  const out = execSync('powershell -Command "Get-Process -Name AppleMusic, AppleTV -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowHandle, MainWindowTitle | Format-Table -AutoSize"').toString();
  console.log('Process status:\n', out);
}, 4000);
