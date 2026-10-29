const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== SEARCHING FOR COMET, BRAVE, AND INSTALLED APPS ===\n');

// 1. Search StartApps (Appx and desktop apps registered in Windows)
try {
  const startApps = execSync('powershell -NoProfile -Command "Get-StartApps | Out-String -Width 220"', { encoding: 'utf8' });
  const lines = startApps.split(/\r?\n/).filter(l => l.trim().length > 0);
  console.log(`Total StartApps registered: ${lines.length}`);
  const matches = lines.filter(l => /comet|brave|edge|opera|firefox|vivaldi|arc|cursor|windsurf/i.test(l));
  console.log('\nMatching StartApps:');
  console.log(matches.join('\n'));
} catch (e) {
  console.error('StartApps error:', e.message);
}

// 2. Search common program directories
const searchDirs = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs'),
  process.env.LOCALAPPDATA || '',
  process.env.ProgramFiles || 'C:\\Program Files',
  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
];

console.log('\nScanning program directories for comet and brave...');
for (const sd of searchDirs) {
  if (!fs.existsSync(sd)) continue;
  try {
    const items = fs.readdirSync(sd);
    for (const it of items) {
      if (/comet|brave/i.test(it)) {
        console.log(`Found in ${sd}: ${it}`);
      }
    }
  } catch (_) {}
}

// 3. Check App Paths in Registry
try {
  const regBrave = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths" /f brave', { encoding: 'utf8' });
  console.log('\nApp Paths brave:\n', regBrave);
} catch (_) {}

try {
  const regComet = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths" /f comet', { encoding: 'utf8' });
  console.log('\nApp Paths comet:\n', regComet);
} catch (_) {}
