const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    backgroundColor: '#0c0e14',
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, '../src/renderer/overlay.html'));
  await new Promise(r => setTimeout(r, 600));

  await win.webContents.executeJavaScript(`
    try {
      const card = document.getElementById('cursor-answer-card');
      if (card) {
        card.className = 'cursor-answer-card assistant-mode flipped-left';
        card.style.top = '-320px';
        card.style.right = '40px';
        card.style.left = 'auto';

        const stream = document.getElementById('chat-stream');
        if (stream) {
          stream.innerHTML = \`
            <div class="chat-turn user">
              Where is the Source Control tab in VS Code?
            </div>
            <div class="chat-turn assistant">
              <div class="chat-spoken-pill">🔊 Spoken response</div>
              <div class="chat-msg-text">
                <p>Source Control is located on the <strong>left Activity Bar</strong>. Here is the shortcut:</p>
                <div class="code-block-wrapper">
                  <pre><code>Ctrl + Shift + G</code></pre>
                </div>
                <div class="chat-target-badge">🎯 Point to Source Control</div>
              </div>
            </div>
            <div class="chat-turn thinking">
              <div class="thinking-dots">
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
              </div>
              <span>Pointy AI is ready for your follow-up...</span>
            </div>
          \`;
        }
      }
    } catch (e) {
      console.error(e);
    }
  `);

  await new Promise(r => setTimeout(r, 600));

  const img = await win.webContents.capturePage();
  fs.writeFileSync('scratch/red-glass-preview.png', img.toPNG());
  console.log('Saved scratch/red-glass-preview.png');

  app.quit();
});
