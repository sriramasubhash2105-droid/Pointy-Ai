const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getUniversalApps() {
  const apps = new Map();

  // 1. Get all Windows StartApps (covers 100% of user-accessible apps)
  try {
    const raw = execSync('powershell -NoProfile -Command "Get-StartApps | ForEach-Object { $_.Name + \' ||| \' + $_.AppID }"', { encoding: 'utf8' });
    const lines = raw.split(/\r?\n/).filter(l => l.includes('|||'));
    for (const line of lines) {
      const [name, appId] = line.split('|||').map(s => s.trim());
      if (!name || !appId) continue;
      
      const lowerName = name.toLowerCase();
      // Skip uninstallers, setup, help, diagnostics
      if (lowerName.includes('uninstall') || lowerName.includes('setup') || lowerName.includes('helper') || lowerName.includes('manual')) {
        continue;
      }

      const item = {
        name,
        appId,
        type: appId.includes('!') || !appId.includes('\\') && !appId.includes(':') ? 'windows_app' : 'start_app',
      };

      apps.set(lowerName, item);

      // Clean aliases
      // e.g. "Brave" -> "brave browser"
      if (lowerName === 'brave') apps.set('brave browser', item);
      if (lowerName === 'comet') apps.set('comet browser', item);
      if (lowerName === 'google chrome') apps.set('chrome', item);
      if (lowerName === 'microsoft edge') apps.set('edge', item);

      // Strip year / version: "adobe premiere pro 2026" -> "adobe premiere pro", "premiere pro", "premiere"
      const noYear = lowerName.replace(/\s+20\d\d(?:\s+.*)?$/i, '').trim();
      if (noYear && noYear !== lowerName) {
        apps.set(noYear, item);
        const shortName = noYear.replace(/^(adobe|autodesk|microsoft)\s+/i, '').trim();
        if (shortName && shortName !== noYear) {
          apps.set(shortName, item);
        }
      }

      // "AutoCAD 2026 - English" -> "autocad"
      if (lowerName.includes('autocad')) {
        apps.set('autocad', item);
      }
    }
  } catch (e) {
    console.warn('Error reading StartApps:', e.message);
  }

  return apps;
}

const apps = getUniversalApps();
console.log(`Total indexed aliases: ${apps.size}`);

const queries = [
  'brave',
  'brave browser',
  'comet',
  'comet browser',
  'capcut',
  'premiere',
  'premiere pro',
  'after effects',
  'autocad',
  'antigravity ide',
  'antigravity',
  'claude',
  'apple music',
  'notion',
  'perplexity',
  'comfyui'
];

console.log('\n--- VERIFYING SEARCH ALIASES ---');
for (const q of queries) {
  const match = apps.get(q);
  console.log(`Query: "${q}" =>`, match ? `${match.name} (${match.appId})` : 'MISSING');
}
