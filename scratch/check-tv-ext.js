const { execSync } = require('child_process');

try {
  const ps = `[xml]$xml = Get-Content 'C:\\Program Files\\WindowsApps\\AppleInc.AppleTVWin_1.1540.23558.0_x64__nzyj5cx40ttqa\\AppxManifest.xml'; $xml.Package.Applications.Application.Extensions.Extension | ConvertTo-Json`;
  const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
  console.log('Apple TV Extensions:', res);
} catch (e) {
  console.error('Err:', e.message);
}
