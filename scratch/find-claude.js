const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('--- FINDING CLAUDE ---');
const searchPaths = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs'),
  path.join(process.env.LOCALAPPDATA || ''),
  path.join(process.env.APPDATA || ''),
  path.join(process.env.ProgramFiles || 'C:\\Program Files'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'),
];

for (const sp of searchPaths) {
  if (!fs.existsSync(sp)) continue;
  try {
    const items = fs.readdirSync(sp);
    for (const it of items) {
      if (/claude/i.test(it)) {
        const full = path.join(sp, it);
        console.log('Found Claude entry:', full);
        try {
          const sub = fs.readdirSync(full);
          console.log('  Contents:', sub.slice(0, 10));
        } catch (_) {}
      }
    }
  } catch (_) {}
}

// Check Windows registry for registered apps or URL protocols
console.log('\n--- CHECKING REGISTRY FOR CLAUDE & APPS ---');
try {
  const regOut = execSync('reg query "HKCU\\Software\\Classes\\claude" /s', { encoding: 'utf8' });
  console.log('Registry claude:\n', regOut);
} catch (e) {
  console.log('No HKCU claude protocol:', e.message);
}

try {
  const regOut = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths" /f claude', { encoding: 'utf8' });
  console.log('App Paths claude:\n', regOut);
} catch (e) {
  console.log('No App Paths claude:', e.message);
}

try {
  const regOut = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f Claude', { encoding: 'utf8' });
  console.log('Uninstall claude:\n', regOut);
} catch (e) {
  console.log('No Uninstall claude:', e.message);
}

try {
  const startApps = execSync('powershell -Command "Get-StartApps | Out-String -Width 200"', { encoding: 'utf8' });
  const claudeLines = startApps.split('\n').filter(l => /claude|apple/i.test(l));
  console.log('\nStartApps matching claude/apple:\n', claudeLines.join('\n'));
} catch (e) {
  console.log('StartApps error:', e.message);
}
