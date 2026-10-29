const { exec } = require('child_process');

const appIdMusic = 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!App';
const appIdTv = 'AppleInc.AppleTVWin_nzyj5cx40ttqa!App';

function testApp(appId, label) {
  const psCmd = `powershell -WindowStyle Hidden -NoProfile -Command "Start-Process 'shell:AppsFolder\\${appId}'"`;
  console.log(`[${label}] Running: ${psCmd}`);
  exec(psCmd, { shell: 'cmd.exe' }, (err, stdout, stderr) => {
    console.log(`[${label}] err:`, err ? err.message : null);
    console.log(`[${label}] stdout:`, stdout);
    console.log(`[${label}] stderr:`, stderr);
  });
}

testApp(appIdMusic, 'Apple Music');
testApp(appIdTv, 'Apple TV');
