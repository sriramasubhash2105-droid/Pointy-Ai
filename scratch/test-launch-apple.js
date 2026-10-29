const { exec } = require('child_process');

console.log('Testing launch methods for Apple Music and Apple TV...');

// Method 1: powershell Start-Process
// Method 2: explorer.exe
// Method 3: start shell:AppsFolder\...

function run(cmd, desc) {
  return new Promise((resolve) => {
    console.log(`\nTesting ${desc}: "${cmd}"`);
    exec(cmd, (err, stdout, stderr) => {
      console.log(`Result: err=${err ? err.message : 'null'}, stderr=${stderr.trim()}, stdout=${stdout.trim()}`);
      resolve();
    });
  });
}

async function testAll() {
  // Let's test explorer.exe with shell:AppsFolder
  await run('explorer.exe "shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"', 'Explorer method');
  await run('powershell -NoProfile -Command "Start-Process \'shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App\'"', 'PowerShell method');
}

testAll();
