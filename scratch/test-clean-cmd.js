const { exec } = require('child_process');

console.log('Testing start AppleMusic.exe');
exec('start AppleMusic.exe', { shell: 'cmd.exe' }, (err, stdout, stderr) => {
  console.log('Apple Music launched:', { err, stdout, stderr });
});

console.log('Testing start AppleTV.exe');
exec('start AppleTV.exe', { shell: 'cmd.exe' }, (err, stdout, stderr) => {
  console.log('Apple TV launched:', { err, stdout, stderr });
});
