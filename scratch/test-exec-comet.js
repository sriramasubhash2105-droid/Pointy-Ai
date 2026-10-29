const { exec } = require('child_process');
const path = require('path');

const cometLnk = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Comet.lnk');
console.log('Testing launch of:', cometLnk);

exec(`start "" "${cometLnk}"`, { shell: 'cmd.exe' }, (err, stdout, stderr) => {
  if (err) {
    console.error('Launch error:', err.message);
  } else {
    console.log('Launch succeeded!');
  }
});
