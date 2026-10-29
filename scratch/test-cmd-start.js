const { exec } = require('child_process');

async function test(cmd, label) {
  return new Promise((resolve) => {
    console.log(`\n--- Testing ${label}: ${cmd} ---`);
    exec(cmd, { shell: 'cmd.exe' }, (err, stdout, stderr) => {
      console.log(`[${label}] Error:`, err ? err.message : 'none');
      console.log(`[${label}] stdout:`, stdout.trim());
      console.log(`[${label}] stderr:`, stderr.trim());
      resolve();
    });
  });
}

async function run() {
  // Test direct cmd.exe start with shell:AppsFolder
  await test('start shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App', 'cmd start shell:AppsFolder Music');
  await test('start shell:AppsFolder\\AppleInc.AppleTVWin_nzyj5cx40ttqa!App', 'cmd start shell:AppsFolder TV');
  await test('start applemusic:', 'URI applemusic:');
  await test('start appletv:', 'URI appletv:');
}

run();
