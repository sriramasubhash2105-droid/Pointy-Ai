const { app, shell } = require('electron');

app.whenReady().then(async () => {
  console.log('Testing shell.openExternal...');
  try {
    await shell.openExternal('music:');
    console.log('Opened music:');
  } catch (e) {
    console.error('music error:', e);
  }

  try {
    await shell.openExternal('videos:');
    console.log('Opened videos:');
  } catch (e) {
    console.error('videos error:', e);
  }

  setTimeout(() => {
    app.quit();
  }, 2000);
});
