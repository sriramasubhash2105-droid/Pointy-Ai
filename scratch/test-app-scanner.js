const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function scanInstalledApps() {
  const apps = new Map();

  // 1. Scan Programs folders for .exe
  const programDirs = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs'),
    process.env.ProgramFiles || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  ];

  for (const pDir of programDirs) {
    if (!fs.existsSync(pDir)) continue;
    try {
      const topDirs = fs.readdirSync(pDir, { withFileTypes: true });
      for (const ent of topDirs) {
        if (ent.isDirectory()) {
          const appDir = path.join(pDir, ent.name);
          try {
            const files = fs.readdirSync(appDir);
            for (const f of files) {
              if (f.endsWith('.exe') && !f.toLowerCase().includes('uninstall') && !f.toLowerCase().includes('update') && !f.toLowerCase().includes('helper')) {
                const appName = ent.name.toLowerCase();
                const exeName = path.basename(f, '.exe').toLowerCase();
                const fullExe = path.join(appDir, f);
                apps.set(appName, { name: ent.name, target: fullExe, type: 'launch_app' });
                apps.set(exeName, { name: ent.name, target: fullExe, type: 'launch_app' });
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // 2. Scan Start Menu Shortcuts (.lnk)
  const shortcutDirs = [
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];

  function walkShortcuts(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const it of items) {
        const full = path.join(dir, it.name);
        if (it.isDirectory()) {
          walkShortcuts(full);
        } else if (it.name.endsWith('.lnk')) {
          const base = path.basename(it.name, '.lnk').toLowerCase();
          if (!base.includes('uninstall') && !base.includes('help')) {
            apps.set(base, { name: path.basename(it.name, '.lnk'), target: full, type: 'launch_shortcut' });
          }
        }
      }
    } catch (_) {}
  }

  for (const sDir of shortcutDirs) {
    walkShortcuts(sDir);
  }

  // 3. Add known Windows Store apps (Appx)
  apps.set('claude', { name: 'Claude', target: 'shell:AppsFolder\\Claude_pzs8sxrjxfjjc!Claude', type: 'windows_app' });
  apps.set('claude app', { name: 'Claude', target: 'shell:AppsFolder\\Claude_pzs8sxrjxfjjc!Claude', type: 'windows_app' });
  apps.set('apple music', { name: 'Apple Music', target: 'shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App', type: 'windows_app' });
  apps.set('apple tv', { name: 'Apple TV', target: 'shell:AppsFolder\\AppleInc.AppleTVWin_nzyj5cx40ttqa!App', type: 'windows_app' });

  // 4. Ensure Antigravity is specifically mapped
  const anti1 = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe');
  const anti2 = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe');
  if (fs.existsSync(anti1)) {
    apps.set('antigravity', { name: 'Antigravity', target: anti1, type: 'launch_app' });
  } else if (fs.existsSync(anti2)) {
    apps.set('antigravity', { name: 'Antigravity IDE', target: anti2, type: 'launch_app' });
  }

  return apps;
}

const apps = scanInstalledApps();
console.log('Total indexed apps/shortcuts:', apps.size);
const sampleNames = ['antigravity', 'claude', 'apple music', 'chrome', 'notion', 'perplexity', 'visual studio code'];
for (const s of sampleNames) {
  console.log(`Check "${s}":`, apps.get(s));
}
