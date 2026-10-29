const { execSync } = require('child_process');

try {
  const ps = `Get-AppxPackage -Name *Apple* | Select-Object Name, PackageFamilyName, InstallLocation | ConvertTo-Json`;
  const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
  console.log('Apple Appx Packages:', res);
} catch (e) {
  console.error('Err:', e.message);
}
