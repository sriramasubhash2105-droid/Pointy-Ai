const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.setPath('userData', path.join(app.getPath('temp'), 'bubble-tail-test-' + Date.now()));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 500,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    }
  });

  await win.loadFile(path.join(__dirname, '../src/renderer/overlay.html'));
  await new Promise(r => setTimeout(r, 400));

  await win.webContents.executeJavaScript(`
    document.body.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
    const bgElem = document.createElement('div');
    bgElem.style.position = 'absolute';
    bgElem.style.top = '140px';
    bgElem.style.left = '280px';
    bgElem.style.color = '#94a3b8';
    bgElem.style.fontSize = '24px';
    bgElem.style.fontWeight = 'bold';
    bgElem.innerText = 'DESKTOP WINDOW TEXT (BACKGROUND TEST)';
    document.body.appendChild(bgElem);

    currentCursorPos = { x: 320, y: 200 };
    aiCursor.style.left = (320 - 3.6) + 'px';
    aiCursor.style.top = (200 - 0.5) + 'px';
    aiCursor.style.bottom = 'auto';
    aiCursor.style.right = 'auto';
    aiCursor.classList.remove('resting', 'hidden');
    aiCursor.classList.add('idle');

    typeOutSpeechBubble("Click here to open Settings!", "Detailed steps inside settings.", true);
  `);

  await new Promise(r => setTimeout(r, 1400));
  let img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'bubble-actions.png'), img.toPNG());
  console.log('Saved bubble-actions.png');

  // Click Continue chat
  await win.webContents.executeJavaScript(`
    const btnContinue = document.getElementById('bubble-btn-continue');
    if (btnContinue) btnContinue.click();
  `);
  await new Promise(r => setTimeout(r, 300));
  img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'bubble-continue-chat.png'), img.toPNG());
  console.log('Saved bubble-continue-chat.png');

  app.quit();
});
