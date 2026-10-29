const { exec } = require('child_process');

console.log('Testing tv.apple.com and music: ...');

exec('cmd.exe /c start https://tv.apple.com', (err) => {
  console.log('tv.apple.com launch result:', err ? err.message : 'OK');
});

exec('cmd.exe /c start music:', (err) => {
  console.log('music: launch result:', err ? err.message : 'OK');
});
