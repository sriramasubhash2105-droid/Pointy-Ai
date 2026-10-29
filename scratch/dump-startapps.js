const { execSync } = require('child_process');
const output = execSync('powershell -NoProfile -Command "Get-StartApps | Select-Object Name, AppId | ConvertTo-Json"', { encoding: 'utf8' });
const apps = JSON.parse(output);
console.log(`Total apps found: ${apps.length}`);
console.log('Sample apps:');
apps.slice(0, 30).forEach(a => console.log(`  - ${a.Name} -> ${a.AppId}`));
