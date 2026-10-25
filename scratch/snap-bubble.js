const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(app.getPath('temp'), 'bubble-test-' + Date.now()));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 600,
    height: 350,
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  await win.loadFile(path.join(__dirname, 'test-bubble.html'));
  await new Promise(r => setTimeout(r, 500));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'bubble-rendered.png'), img.toPNG());
  console.log('Saved scratch/bubble-rendered.png');
  app.quit();
});
