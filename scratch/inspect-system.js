const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('=== SYSTEM INSPECTION FOR DESKTOP ACTIONS ===\n');

// 1. Chrome Profiles
const chromeUserData = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
console.log('--- CHROME USER DATA ---');
console.log('Path:', chromeUserData);
if (fs.existsSync(chromeUserData)) {
  const localStateFile = path.join(chromeUserData, 'Local State');
  if (fs.existsSync(localStateFile)) {
    try {
      const localState = JSON.parse(fs.readFileSync(localStateFile, 'utf8'));
      const infoCache = localState.profile?.info_cache || {};
      console.log('Chrome Profiles found in Local State:');
      for (const [profDir, info] of Object.entries(infoCache)) {
        console.log(`  - Directory: "${profDir}" | Name: "${info.name}" | Email: "${info.user_name || info.hosted_domain || 'N/A'}"`);
      }
    } catch (e) {
      console.warn('Error reading Local State:', e.message);
    }
  }
} else {
  console.log('Chrome User Data not found at default location.');
}

// 2. Start Menu Programs & Shortcuts
console.log('\n--- SCANNING INSTALLED SHORTCUTS (.lnk) ---');
const shortcutDirs = [
  path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs'),
];

function scanShortcuts(dir, matches = []) {
  if (!fs.existsSync(dir)) return matches;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanShortcuts(fullPath, matches);
      } else {
        const lower = ent.name.toLowerCase();
        if (
          lower.includes('anti') ||
          lower.includes('claude') ||
          lower.includes('music') ||
          lower.includes('apple') ||
          lower.includes('chrome') ||
          lower.includes('code') ||
          lower.includes('spotify')
        ) {
          matches.push({ name: ent.name, fullPath });
        }
      }
    }
  } catch (_) {}
  return matches;
}

const found = [];
for (const sDir of shortcutDirs) {
  scanShortcuts(sDir, found);
}
console.log('Found matching shortcuts:');
found.forEach(f => console.log(`  - ${f.name} => ${f.fullPath}`));

// 3. Check AppData for Antigravity & Claude
console.log('\n--- CHECKING APPDATA DIRECTORIES ---');
const appDataDirs = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs'),
  process.env.LOCALAPPDATA || '',
  path.join(os.homedir(), '.gemini'),
  path.join(os.homedir(), 'AppData', 'Local'),
];

for (const ad of appDataDirs) {
  if (fs.existsSync(ad)) {
    try {
      const items = fs.readdirSync(ad);
      const m = items.filter(i => /anti|claude|apple/i.test(i));
      if (m.length > 0) {
        console.log(`In ${ad}:`, m);
      }
    } catch (_) {}
  }
}

// 4. Apple Music Windows Store App or URI
console.log('\n--- CHECKING APPLE MUSIC / MEDIA APPS ---');
try {
  const storeApps = execSync('powershell -Command "Get-AppxPackage *apple* | Select-Object Name, PackageFamilyName"', { encoding: 'utf8' });
  console.log('Apple Appx Packages:\n' + storeApps.trim());
} catch (e) {
  console.log('Appx check error:', e.message);
}
