const { exec } = require('child_process');

function test(cmd, desc) {
  return new Promise((resolve) => {
    console.log(`\nTesting ${desc}: ${cmd}`);
    exec(cmd, { shell: 'cmd.exe' }, (err, stdout, stderr) => {
      console.log(`[${desc}] err:`, err ? err.message : null);
      console.log(`[${desc}] stdout:`, stdout);
      console.log(`[${desc}] stderr:`, stderr);
      resolve(!err);
    });
  });
}

async function run() {
  await test('start "" "shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"', 'start with empty title and quotes');
  await test('start shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App', 'start without quotes');
  await test('start applemusic:', 'start URI applemusic:');
  await test('start appletv:', 'start URI appletv:');
}

run();
