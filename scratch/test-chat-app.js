const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
}
loadEnv();

const ConversationManager = require('../src/main/services/conversation-manager');
const ARTIFACT_DIR = path.resolve('C:/Users/srira/.gemini/antigravity-ide/brain/5daa5936-ef94-4d38-8aa9-d6a1e2e57d6c');

const convManager = new ConversationManager();

// Register IPC handlers for test
ipcMain.handle('chat-get-conversations', () => convManager.getAllConversations());
ipcMain.handle('chat-get-conversation', (e, id) => convManager.getConversation(id));
ipcMain.handle('chat-create-conversation', (e, title) => convManager.startNewConversation(title));
ipcMain.handle('chat-pin-conversation', (e, id, pin) => convManager.pinConversation(id, pin));
ipcMain.handle('chat-rename-conversation', (e, id, t) => convManager.renameConversation(id, t));
ipcMain.handle('chat-delete-conversation', (e, id) => convManager.deleteConversation(id));
ipcMain.handle('chat-clear-all-conversations', () => { convManager.clearAllConversations(); return true; });
ipcMain.handle('chat-get-api-keys', () => ({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 8)}••••••••` : '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GOOGLE_TTS_API_KEY: process.env.GOOGLE_TTS_API_KEY ? `${process.env.GOOGLE_TTS_API_KEY.slice(0, 8)}••••••••` : '',
  ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY ? `${process.env.ASSEMBLYAI_API_KEY.slice(0, 8)}••••••••` : '',
}));
ipcMain.handle('chat-save-api-keys', (e, keys) => {
  if (keys && keys.GEMINI_MODEL) process.env.GEMINI_MODEL = keys.GEMINI_MODEL;
  return { success: true };
});
ipcMain.handle('chat-test-gemini-key', () => ({ success: true, modelResponse: 'Hello! I am ready.' }));
ipcMain.handle('chat-is-overlay-active', () => true);
ipcMain.handle('chat-toggle-overlay', () => true);

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1260,
    height: 820,
    show: true,
    backgroundColor: '#0d0d0d',
    title: 'Pointy AI',
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '../src/renderer/chat-app.html'));

  win.webContents.on('did-finish-load', async () => {
    console.log('[Test] Pointy AI app loaded successfully');

    await new Promise(r => setTimeout(r, 1500));

    // Capture main home screen screenshot
    const homeImage = await win.capturePage();
    const homePath = path.join(ARTIFACT_DIR, 'pointy_ai_home.png');
    fs.writeFileSync(homePath, homeImage.toPNG());
    console.log('[Test] Saved pointy_ai_home.png');

    // Click the first conversation to show active chat turn
    await win.webContents.executeJavaScript(`
      const firstChat = document.querySelector('.chat-item');
      if (firstChat) firstChat.click();
    `);
    await new Promise(r => setTimeout(r, 800));

    // Capture conversation thread view
    const threadImage = await win.capturePage();
    const threadPath = path.join(ARTIFACT_DIR, 'pointy_ai_thread.png');
    fs.writeFileSync(threadPath, threadImage.toPNG());
    console.log('[Test] Saved pointy_ai_thread.png');

    // Open settings modal
    await win.webContents.executeJavaScript(`
      document.getElementById('btn-open-settings').click();
    `);
    await new Promise(r => setTimeout(r, 700));

    // Capture settings modal screenshot
    const settingsImage = await win.capturePage();
    const settingsPath = path.join(ARTIFACT_DIR, 'pointy_ai_settings.png');
    fs.writeFileSync(settingsPath, settingsImage.toPNG());
    console.log('[Test] Saved pointy_ai_settings.png');

    setTimeout(() => {
      win.close();
      app.quit();
      process.exit(0);
    }, 600);
  });
});
