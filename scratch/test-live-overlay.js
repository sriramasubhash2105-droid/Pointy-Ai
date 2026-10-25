const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(app.getPath('temp'), 'live-overlay-test-' + Date.now()));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  await win.loadFile(path.join(__dirname, '../src/renderer/overlay.html'));
  await new Promise(r => setTimeout(r, 400));

  // Position Pointy at (320, 240)
  await win.webContents.executeJavaScript(`
    currentCursorPos = { x: 320, y: 240 };
    aiCursor.style.left = (320 - 3.6) + 'px';
    aiCursor.style.top = (240 - 0.5) + 'px';
    aiCursor.style.bottom = 'auto';
    aiCursor.style.right = 'auto';
    aiCursor.classList.remove('resting', 'hidden');
    aiCursor.classList.add('idle');
    typeOutSpeechBubble("I found the Settings button right here! Look where I am pointing.", "### Settings Navigation\\nClick the gear icon in the lower bottom or press Ctrl+, to open settings.", true);
  `);

  // Wait for typing to complete (around 2200ms)
  await new Promise(r => setTimeout(r, 2200));
  let img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'live-bubble-completed.png'), img.toPNG());

  // Click view full details
  await win.webContents.executeJavaScript(`
    const toggle = document.getElementById('bubble-details-toggle');
    if (toggle) toggle.click();
  `);
  await new Promise(r => setTimeout(r, 400));
  img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'live-bubble-expanded.png'), img.toPNG());

  console.log('Saved live-bubble-completed.png and live-bubble-expanded.png');
  app.quit();
});
