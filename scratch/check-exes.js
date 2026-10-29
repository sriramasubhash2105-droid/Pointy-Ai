const { execSync } = require('child_process');

try {
  const ps = `Get-ChildItem -Path 'C:\\Program Files\\WindowsApps\\AppleInc.AppleMusicWin_1.1540.23042.0_x64__nzyj5cx40ttqa' -Filter '*.exe' | Select-Object -ExpandProperty Name`;
  const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
  console.log('Apple Music EXEs:', res);

  const ps2 = `Get-ChildItem -Path 'C:\\Program Files\\WindowsApps\\AppleInc.AppleTVWin_1.1540.23558.0_x64__nzyj5cx40ttqa' -Filter '*.exe' | Select-Object -ExpandProperty Name`;
  const res2 = execSync(`powershell -NoProfile -Command "${ps2}"`, { encoding: 'utf8' });
  console.log('Apple TV EXEs:', res2);
} catch (e) {
  console.error('Err:', e.message);
}
