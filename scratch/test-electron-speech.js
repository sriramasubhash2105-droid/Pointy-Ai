const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true } });
  win.loadURL('about:blank');
  win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      resolve({
        hasSpeechSynthesis: 'speechSynthesis' in window,
        voiceCount: voices.length,
        voices: voices.map(v => ({ name: v.name, lang: v.lang }))
      });
    })
  `).then((res) => {
    console.log('Browser SpeechSynthesis status in Electron:', res);
    app.quit();
  });
});
