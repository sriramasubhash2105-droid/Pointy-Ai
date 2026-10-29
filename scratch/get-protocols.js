const { execSync } = require('child_process');

try {
  const ps = `(Get-AppxPackageManifest -Package 'AppleInc.AppleMusicWin_1.1540.23042.0_x64__nzyj5cx40ttqa').Package.Applications.Application.Extensions.Extension | Where-Object { $_.Category -eq 'windows.protocol' } | ForEach-Object { $_.Protocol.Name }`;
  const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
  console.log('Apple Music Protocols:', res);

  const ps2 = `(Get-AppxPackageManifest -Package 'AppleInc.AppleTVWin_1.1540.23558.0_x64__nzyj5cx40ttqa').Package.Applications.Application.Extensions.Extension | Where-Object { $_.Category -eq 'windows.protocol' } | ForEach-Object { $_.Protocol.Name }`;
  const res2 = execSync(`powershell -NoProfile -Command "${ps2}"`, { encoding: 'utf8' });
  console.log('Apple TV Protocols:', res2);
} catch (e) {
  console.error('Err:', e.message);
}
