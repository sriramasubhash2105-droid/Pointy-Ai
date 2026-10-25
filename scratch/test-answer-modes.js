const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: '#0c0e14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] ${message}`);
  });

  await win.loadFile(path.join(__dirname, '../src/renderer/overlay.html'));
  await new Promise(r => setTimeout(r, 1000));

  // Test 1: Render Single Answer (Only the answer the user asked for!)
  await win.webContents.executeJavaScript(`
    try {
      console.log('Testing handlePointAt...');
      currentCursorPos = { x: 300, y: 200 };
      const cursor = document.getElementById('ai-cursor');
      cursor.classList.remove('idle');
      cursor.classList.add('pointing');
      cursor.style.bottom = 'auto';
      cursor.style.right = 'auto';
      cursor.style.left = '300px';
      cursor.style.top = '200px';

      handlePointAt({
        found: true,
        mode: 'pointer',
        reply: 'Source Control is on the left Activity Bar.',
        steps: [{ x: 300, y: 200, label: 'Source Control' }]
      }, null, null, 'Where is Source Control?');

      if (answerDismissTimer) {
        clearTimeout(answerDismissTimer);
        answerDismissTimer = null;
      }
      console.log('handlePointAt completed successfully!');
    } catch (err) {
      console.error('Error in Test 1:', err);
    }
  `);

  await new Promise(r => setTimeout(r, 650));

  await win.webContents.executeJavaScript(`
    const card = document.getElementById('cursor-answer-card');
    const cur = document.getElementById('ai-cursor');
    const stream = document.getElementById('chat-stream');
    const rect = card.getBoundingClientRect();
    const curRect = cur.getBoundingClientRect();
    console.log('[DEBUG] cur.getBoundingClientRect:', JSON.stringify(curRect));
    console.log('[DEBUG] card.getBoundingClientRect:', JSON.stringify(rect));
    const matchedRules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && card.matches(rule.selectorText) && rule.style.opacity) {
            matchedRules.push({ selector: rule.selectorText, opacity: rule.style.opacity });
          }
        }
      } catch (e) {}
    }
    const anims = card.getAnimations().map(a => ({
      name: a.animationName,
      state: a.playState,
      time: a.currentTime,
      opacity: window.getComputedStyle(card).opacity
    }));
    console.log('[DEBUG] card animations detail:', JSON.stringify(anims));
    console.log('[DEBUG] card final computed opacity:', window.getComputedStyle(card).opacity);
  `);

  await new Promise(r => setTimeout(r, 400));
  const shot1 = await win.webContents.capturePage();
  fs.writeFileSync('scratch/preview-single-answer.png', shot1.toPNG());
  console.log('Saved scratch/preview-single-answer.png (Single Answer Mode)');

  // Test 2: User asks a follow-up question right after!
  await win.webContents.executeJavaScript(`
    const input = document.getElementById('card-chat-input');
    if (input) {
      input.value = 'What is the keyboard shortcut for it?';
      submitFollowUpQuestion();
    }
  `);

  await new Promise(r => setTimeout(r, 400));

  // Simulate receiving follow-up answer from Gemini
  await win.webContents.executeJavaScript(`
    handlePointAt({
      found: true,
      mode: 'assistant',
      reply: 'The shortcut is Ctrl + Shift + G.',
      detailed_explanation: 'You can toggle the Source Control panel with this shortcut:\\n\\n\`\`\`\\nCtrl + Shift + G\\n\`\`\`\\nPress it again to focus your staged changes.',
      steps: []
    }, null, null, 'What is the keyboard shortcut for it?');
  `);

  await new Promise(r => setTimeout(r, 600));
  const shot2 = await win.webContents.capturePage();
  fs.writeFileSync('scratch/preview-followup-chat.png', shot2.toPNG());
  console.log('Saved scratch/preview-followup-chat.png (Follow-Up Multi-Turn Chat Mode)');

  app.quit();
});
