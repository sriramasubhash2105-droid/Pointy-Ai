const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Testing desktop action commands...\n');

// 1. Antigravity test
const antigravityPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe');
console.log('Antigravity path exists:', fs.existsSync(antigravityPath));

// 2. Claude App test
const claudeAppId = 'Claude_pzs8sxrjxfjjc!Claude';
console.log('Claude App ID:', claudeAppId);

// 3. Apple Music test
const appleMusicAppId = 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!App';
console.log('Apple Music App ID:', appleMusicAppId);

// 4. Chrome Profiles test
const localStatePath = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Local State');
if (fs.existsSync(localStatePath)) {
  const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
  const cache = localState.profile?.info_cache || {};
  console.log('Chrome profiles loaded:', Object.keys(cache).length);
  for (const [dir, info] of Object.entries(cache)) {
    if (/student/i.test(info.name) || /student/i.test(info.user_name || '')) {
      console.log(`  -> Student profile identified: Directory="${dir}" | Name="${info.name}" | Email="${info.user_name}"`);
    }
  }
}

// 5. Test building the commands:
console.log('\nGenerated commands:');
console.log('Launch Antigravity:', `start "" "${antigravityPath}"`);
console.log('Launch Claude App:', `explorer.exe shell:AppsFolder\\${claudeAppId}`);
console.log('Launch Apple Music:', `explorer.exe shell:AppsFolder\\${appleMusicAppId}`);
console.log('Open Chrome Student:', `start "" "chrome.exe" --profile-directory="Profile 2"`);
console.log('Open Calendar Student:', `start "" "chrome.exe" --profile-directory="Profile 2" "https://calendar.google.com"`);
