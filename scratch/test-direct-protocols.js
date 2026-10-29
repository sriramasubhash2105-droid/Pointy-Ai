const { exec } = require('child_process');

console.log('Testing start music: and start videos: directly from Node:');
exec('start music:', { shell: 'cmd.exe' }, (err) => {
  if (err) console.error('music err', err);
  else console.log('music dispatched');
});

exec('start videos:', { shell: 'cmd.exe' }, (err) => {
  if (err) console.error('videos err', err);
  else console.log('videos dispatched');
});
