const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    show: false,
    webPreferences: {
      contextIsolation: true,
    },
  });

  await win.loadFile(path.join(__dirname, 'preview-card.html'));
  await new Promise(r => setTimeout(r, 600));

  const img = await win.webContents.capturePage();
  fs.writeFileSync('scratch/red-glass-preview.png', img.toPNG());
  console.log('Successfully captured scratch/red-glass-preview.png');
  app.quit();
});
