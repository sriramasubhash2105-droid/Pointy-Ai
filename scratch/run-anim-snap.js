const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(app.getPath('temp'), 'anim-test-' + Date.now()));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 700, height: 400, show: false });
  await win.loadFile(path.join(__dirname, 'test-animation.html'));
  
  // Snap at early typing (250ms)
  await new Promise(r => setTimeout(r, 200));
  let img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'anim-early.png'), img.toPNG());

  // Snap at mid typing (700ms)
  await new Promise(r => setTimeout(r, 600));
  img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'anim-mid.png'), img.toPNG());

  // Snap when finished (2000ms)
  await new Promise(r => setTimeout(r, 1800));
  img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'anim-finish.png'), img.toPNG());

  console.log('Saved anim-early.png, anim-mid.png, anim-finish.png');
  app.quit();
});
