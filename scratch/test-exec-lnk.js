const { exec } = require('child_process');
const path = require('path');

const braveLnk = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Brave.lnk');
console.log('Testing launch of:', braveLnk);

exec(`start "" "${braveLnk}"`, { shell: 'cmd.exe' }, (err, stdout, stderr) => {
  if (err) {
    console.error('Launch error:', err.message);
  } else {
    console.log('Launch succeeded!');
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
  }
});
