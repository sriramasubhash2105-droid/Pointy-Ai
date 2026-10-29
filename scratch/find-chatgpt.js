const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Searching for ChatGPT installation on this PC...');

// 1. Get-StartApps
try {
  const raw = execSync('powershell -NoProfile -Command "Get-StartApps | ConvertTo-Json -Compress"', { encoding: 'utf8' });
  const list = JSON.parse(raw);
  const startMatches = list.filter(i => 
    i.Name.toLowerCase().includes('gpt') || 
    i.Name.toLowerCase().includes('chat') || 
    i.Name.toLowerCase().includes('openai') ||
    i.AppID.toLowerCase().includes('gpt') ||
    i.AppID.toLowerCase().includes('openai')
  );
  console.log('StartApps:', startMatches);
} catch (e) {
  console.error('StartApps error:', e.message);
}

// 2. Get-AppxPackage
try {
  const rawAppx = execSync('powershell -NoProfile -Command "Get-AppxPackage | Where-Object { $_.Name -like \'*openai*\' -or $_.Name -like \'*chatgpt*\' } | Select-Object Name, PackageFamilyName, InstallLocation | ConvertTo-Json -Compress"', { encoding: 'utf8' });
  console.log('Appx Packages:', rawAppx);
} catch (e) {
  console.error('Appx error:', e.message);
}

// 3. Check AppData paths
const checkPaths = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ChatGPT', 'ChatGPT.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'OpenAI', 'ChatGPT.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'ChatGPT', 'ChatGPT.exe'),
  path.join(process.env.PROGRAMFILES || '', 'ChatGPT', 'ChatGPT.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || '', 'ChatGPT', 'ChatGPT.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'chatgpt.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'ChatGPT.exe'),
];

for (const p of checkPaths) {
  if (fs.existsSync(p)) {
    console.log('Found executable path:', p);
  }
}

// 4. Test URI protocol `chatgpt:`
try {
  const rawReg = execSync('powershell -NoProfile -Command "Get-ItemProperty -Path \'HKCR:\\chatgpt\' -ErrorAction SilentlyContinue | ConvertTo-Json -Compress"', { encoding: 'utf8' });
  console.log('chatgpt: protocol in registry:', rawReg || 'none');
} catch (e) {
  console.log('Registry check error:', e.message);
}
