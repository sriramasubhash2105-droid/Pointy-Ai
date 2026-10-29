const { execSync } = require('child_process');
const raw = execSync('powershell -NoProfile -Command "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress"', { encoding: 'utf8' });
const apps = JSON.parse(raw);
console.log(`Found ${apps.length} apps:`);
for (const app of apps) {
  console.log(`- ${app.Name} (${app.AppID})`);
}
