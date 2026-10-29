const { execSync } = require('child_process');

const output = execSync('powershell -NoProfile -Command "Get-StartApps | ForEach-Object { $_.Name + \' ||| \' + $_.AppID }"', { encoding: 'utf8' });
const lines = output.split(/\r?\n/).filter(l => l.includes('|||'));

const apps = lines.map(line => {
  const [name, appId] = line.split('|||').map(s => s.trim());
  return { name, appId };
});

console.log(`Parsed ${apps.length} StartApps.`);

const testTargets = ['comet', 'brave', 'capcut', 'antigravity ide', 'claude', 'adobe premiere'];
for (const target of testTargets) {
  const match = apps.find(a => a.name.toLowerCase() === target || a.name.toLowerCase().startsWith(target));
  if (match) {
    console.log(`Matched "${target}" => Name: "${match.name}", AppID: "${match.appId}"`);
  } else {
    console.log(`No match for "${target}"`);
  }
}
