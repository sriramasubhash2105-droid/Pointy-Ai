const { exec } = require('child_process');

// In Windows, the most reliable way to launch an Appx/UWP package via PowerShell that ALWAYS brings its window to the foreground:
// 1. Using shell:AppsFolder with explorer:
// exec('cmd.exe /c start shell:AppsFolder\\AppleInc.AppleTVWin_nzyj5cx40ttqa!App');
// 2. Or using PowerShell Start-Process WITHOUT -WindowStyle Hidden:
// powershell -NoProfile -Command "Start-Process 'shell:AppsFolder\AppleInc.AppleTVWin_nzyj5cx40ttqa!App'"

const cmd1 = 'start shell:AppsFolder\\AppleInc.AppleTVWin_nzyj5cx40ttqa!App';
const cmd2 = 'start shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App';

console.log('Testing cmd1:', cmd1);
exec(cmd1, { shell: 'cmd.exe' }, (err) => {
  console.log('cmd1 err:', err ? err.message : 'none');
});

console.log('Testing cmd2:', cmd2);
exec(cmd2, { shell: 'cmd.exe' }, (err) => {
  console.log('cmd2 err:', err ? err.message : 'none');
});
