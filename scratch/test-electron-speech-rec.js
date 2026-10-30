const { app, BrowserWindow } = require('electron');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
  await win.loadURL('about:blank');
  const res = await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return resolve('no_SR_in_window');
      const sr = new SR();
      sr.onerror = (e) => resolve('error: ' + e.error);
      sr.onstart = () => resolve('started');
      sr.onend = () => resolve('ended');
      setTimeout(() => resolve('timeout'), 3000);
      try {
        sr.start();
      } catch (err) {
        resolve('catch: ' + err.message);
      }
    })
  `);
  console.log('SpeechRecognition result in Electron:', res);
  app.quit();
});
