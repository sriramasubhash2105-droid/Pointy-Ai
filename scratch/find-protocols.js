const { execSync } = require('child_process');

try {
  const ps = `Get-ChildItem -Path 'HKCR:\\' | Where-Object { $_.Name -like '*apple*' -or $_.Name -like '*music*' -or $_.Name -like '*itms*' } | Select-Object -ExpandProperty PSChildName`;
  const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
  console.log('Registered Protocols:', res);
} catch (e) {
  console.error('Err:', e.message);
}
