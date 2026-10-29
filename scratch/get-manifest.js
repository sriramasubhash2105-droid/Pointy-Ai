const { execSync } = require('child_process');

try {
  const ps = `Get-AppxPackageManifest -Package 'AppleInc.AppleMusicWin_1.1540.23042.0_x64__nzyj5cx40ttqa' | Select-Object -ExpandProperty Package | Select-Object -ExpandProperty Applications | Select-Object -ExpandProperty Application | ConvertTo-Json`;
  const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
  console.log('Apple Music Application Manifest:', res);
} catch (e) {
  console.error('Err:', e.message);
}
