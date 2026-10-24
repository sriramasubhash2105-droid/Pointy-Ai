const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  const win = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, '../src/renderer/overlay.html'));

  // Trigger toggleTextInput()
  await win.webContents.executeJavaScript(`
    toggleTextInput();
  `);

  await new Promise(r => setTimeout(r, 600));

  const img = await win.webContents.capturePage();
  fs.writeFileSync('scratch/typing-box-preview.png', img.toPNG());
  console.log('Saved scratch/typing-box-preview.png');

  app.quit();
});
