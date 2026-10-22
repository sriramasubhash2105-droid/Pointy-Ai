const { app, BrowserWindow, Tray, Menu, ipcMain, screen, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const { GnaniService } = require('./services/gnani-service');
const { GeminiService } = require('./services/gemini-service');

// Keep references to prevent garbage collection
let overlayWindow = null;
let tray = null;
let gnaniService = null;
let geminiService = null;
let appState = 'idle'; // idle | listening | thinking | pointing | waiting_next

// ─── App Configuration ───────────────────────────────────────────────
const CONFIG = {
  hotkey: 'CommandOrControl+Shift+Space',
  gnaniApiKey: process.env.GNANI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

// ─── Create the transparent overlay window ───────────────────────────
function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();

  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: primaryDisplay.size.width,
    height: primaryDisplay.size.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Make entire window click-through by default
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Keep on top of everything including fullscreen apps
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  overlayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));

  // Don't show in alt-tab
  overlayWindow.setSkipTaskbar(true);

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// ─── Create the system tray ──────────────────────────────────────────
function createTray() {
  const iconSize = 16;
  const icon = nativeImage.createFromBuffer(
    createTrayIconBuffer(iconSize),
    { width: iconSize, height: iconSize }
  );

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: '🎯 Pointy AI', enabled: false },
    { type: 'separator' },
    { label: `Hotkey: ${CONFIG.hotkey}`, enabled: false },
    {
      label: 'Set API Keys...',
      click: () => promptApiKey(),
    },
    { type: 'separator' },
    {
      label: 'Show Buddy',
      click: () => overlayWindow?.webContents.send('toggle-buddy', true),
    },
    {
      label: 'Hide Buddy',
      click: () => overlayWindow?.webContents.send('toggle-buddy', false),
    },
    { type: 'separator' },
    {
      label: 'Quit Pointy',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Pointy AI - Press Ctrl+Shift+Space to ask');
  tray.setContextMenu(contextMenu);
}

// Create a simple colored icon buffer for the tray
function createTrayIconBuffer(size) {
  const buffer = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt(Math.pow(x - size / 2, 2) + Math.pow(y - size / 2, 2));
      if (dist < size / 2 - 1) {
        buffer[idx] = 100;     // R
        buffer[idx + 1] = 120; // G
        buffer[idx + 2] = 255; // B
        buffer[idx + 3] = 255; // A
      } else {
        buffer[idx + 3] = 0;
      }
    }
  }
  return buffer;
}

// ─── Register global hotkeys ─────────────────────────────────────────
function registerHotkeys() {
  globalShortcut.register(CONFIG.hotkey, () => {
    handleHotkeyPress();
  });

  globalShortcut.register('Escape', () => {
    if (appState !== 'idle') {
      resetState();
    }
  });
}

// ─── Handle the main hotkey press ────────────────────────────────────
async function handleHotkeyPress() {
  if (appState === 'listening') {
    // Stop listening and process
    appState = 'thinking';
    overlayWindow?.webContents.send('state-change', 'thinking');
    overlayWindow?.webContents.send('stop-recording');
    return;
  }

  if (appState !== 'idle') {
    resetState();
    return;
  }

  // Start listening
  appState = 'listening';
  overlayWindow?.webContents.send('state-change', 'listening');
  overlayWindow?.webContents.send('start-recording');
}

// ─── Process the user's voice question ───────────────────────────────
async function processQuestion(audioBuffer) {
  try {
    appState = 'thinking';
    overlayWindow?.webContents.send('state-change', 'thinking');

    // Step 1: Take a screenshot
    console.log('[Pointy] 📸 Capturing screen...');
    const screenshotBuffer = await screenshot({ format: 'png' });

    // Step 2: Transcribe audio with Prisma (or use Web Speech API fallback)
    console.log('[Pointy] 🎤 Transcribing...');
    let transcript, detectedLang;

    if (gnaniService.hasApiKey()) {
      const sttResult = await gnaniService.transcribe(audioBuffer);
      transcript = sttResult.transcript;
      detectedLang = sttResult.language || 'en-IN';
    } else {
      // Demo mode - use a sample question
      transcript = 'Where is the settings button?';
      detectedLang = 'en-IN';
    }

    console.log(`[Pointy] 💬 Transcript: "${transcript}" (${detectedLang})`);
    overlayWindow?.webContents.send('transcript', { text: transcript, lang: detectedLang });

    // Step 3: Send screenshot + question to Gemini Flash 2.5
    await analyzeAndPoint(screenshotBuffer, transcript, detectedLang);

  } catch (error) {
    console.error('[Pointy] Error processing question:', error);
    overlayWindow?.webContents.send('error', error.message);
    resetState();
  }
}

// ─── Process a typed question ────────────────────────────────────────
async function processTypedQuestion(question) {
  try {
    appState = 'thinking';
    overlayWindow?.webContents.send('state-change', 'thinking');

    console.log('[Pointy] 📸 Capturing screen...');
    const screenshotBuffer = await screenshot({ format: 'png' });

    overlayWindow?.webContents.send('transcript', { text: question, lang: 'en-IN' });

    // Send screenshot + question to Gemini Flash 2.5
    await analyzeAndPoint(screenshotBuffer, question, 'en-IN');

  } catch (error) {
    console.error('[Pointy] Error:', error);
    overlayWindow?.webContents.send('error', error.message);
    resetState();
  }
}

// ─── Core: Send screenshot to Gemini and point at result ─────────────
async function analyzeAndPoint(screenshotBuffer, question, language) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const displayInfo = {
    scaleFactor: primaryDisplay.scaleFactor,
    width: primaryDisplay.size.width,
    height: primaryDisplay.size.height,
  };

  let result;

  if (geminiService.hasApiKey()) {
    // 🚀 Use Gemini Flash 2.5 — vision model sees screenshot directly
    console.log('[Pointy] 🧠 Asking Gemini Flash 2.5...');
    result = await geminiService.analyzeScreen(screenshotBuffer, question, language, displayInfo);
  } else {
    // Demo mode — return a simulated result
    console.log('[Pointy] ⚠️  No GEMINI_API_KEY — using demo response');
    result = getDemoResponse(question);
  }

  console.log('[Pointy] ✅ Result:', JSON.stringify(result, null, 2));

  // Point at the target elements
  appState = 'pointing';
  overlayWindow?.webContents.send('state-change', 'pointing');
  overlayWindow?.webContents.send('point-at', { result });

  // Speak the reply with Timbre (or browser TTS fallback)
  if (result.reply) {
    if (gnaniService.hasApiKey()) {
      console.log('[Pointy] 🔊 Speaking with Timbre...');
      const audioData = await gnaniService.speak(result.reply, result.reply_lang || language);
      if (audioData) {
        overlayWindow?.webContents.send('play-audio', audioData.toString('base64'));
      }
    } else {
      // Use browser's built-in speech synthesis as fallback
      overlayWindow?.webContents.send('speak-fallback', {
        text: result.reply,
        lang: result.reply_lang || language,
      });
    }
  }
}

// ─── Demo response when no API key is set ────────────────────────────
function getDemoResponse(question) {
  const q = question.toLowerCase();
  const primaryDisplay = screen.getPrimaryDisplay();
  const sw = primaryDisplay.size.width;
  const sh = primaryDisplay.size.height;

  // Simulate finding a UI element based on common keywords
  if (q.includes('setting') || q.includes('gear') || q.includes('config')) {
    return {
      found: true,
      reply: 'Here are the Settings! Look at this button right here.',
      reply_lang: 'en-IN',
      steps: [{ x: sw - 80, y: 12, w: 40, h: 40, label: 'Settings', instruction: 'This is the Settings button' }],
    };
  }
  if (q.includes('close') || q.includes('exit') || q.includes('quit')) {
    return {
      found: true,
      reply: 'Here is the close button, in the top right corner.',
      reply_lang: 'en-IN',
      steps: [{ x: sw - 30, y: 8, w: 46, h: 32, label: 'Close', instruction: 'This is the Close button' }],
    };
  }
  if (q.includes('search') || q.includes('find')) {
    return {
      found: true,
      reply: 'You can search using this search bar right here!',
      reply_lang: 'en-IN',
      steps: [{ x: sw / 2 - 150, y: 50, w: 300, h: 36, label: 'Search', instruction: 'Type your search here' }],
    };
  }

  return {
    found: true,
    reply: `I see your screen! In demo mode, I'm pointing at the center. Set GEMINI_API_KEY for real analysis.`,
    reply_lang: 'en-IN',
    steps: [{ x: sw / 2 - 50, y: sh / 2 - 20, w: 100, h: 40, label: 'Demo Target', instruction: 'Set GEMINI_API_KEY for real results' }],
  };
}

// ─── Reset to idle state ─────────────────────────────────────────────
function resetState() {
  appState = 'idle';
  overlayWindow?.webContents.send('state-change', 'idle');
  overlayWindow?.webContents.send('reset');
}

// ─── Prompt for API keys ─────────────────────────────────────────────
function promptApiKey() {
  const { dialog } = require('electron');
  dialog.showMessageBox({
    type: 'info',
    title: 'Set API Keys',
    message: [
      'Set your API keys as environment variables and restart Pointy:',
      '',
      '  GEMINI_API_KEY=your_gemini_key    (required — for screen vision)',
      '  GNANI_API_KEY=your_gnani_key      (optional — for voice in/out)',
      '',
      'PowerShell example:',
      '  $env:GEMINI_API_KEY="your_key"',
      '  npm start',
      '',
      'Get a free Gemini API key at: https://aistudio.google.com/apikey',
    ].join('\n'),
    buttons: ['OK'],
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, options || {});
    }
  });

  // Receive recorded audio from renderer
  ipcMain.on('audio-recorded', async (event, audioBase64) => {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    await processQuestion(audioBuffer);
  });

  // Receive typed question
  ipcMain.on('typed-question', async (event, question) => {
    await processTypedQuestion(question);
  });

  // State management
  ipcMain.on('pointing-complete', () => {
    appState = 'idle';
  });

  ipcMain.on('request-reset', () => {
    resetState();
  });

  // Get display info for coordinate mapping
  ipcMain.handle('get-display-info', () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    return {
      scaleFactor: primaryDisplay.scaleFactor,
      size: primaryDisplay.size,
      workArea: primaryDisplay.workArea,
    };
  });

  // Take screenshot on demand
  ipcMain.handle('take-screenshot', async () => {
    try {
      const buf = await screenshot({ format: 'png' });
      return buf.toString('base64');
    } catch (e) {
      console.error('[Pointy] Screenshot error:', e);
      return null;
    }
  });
}

// ─── App lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Initialize services
  gnaniService = new GnaniService(CONFIG.gnaniApiKey);
  geminiService = new GeminiService(CONFIG.geminiApiKey);

  // Create overlay and tray
  createOverlayWindow();
  createTray();
  setupIPC();
  registerHotkeys();

  console.log('[Pointy] 🎯 Pointy AI is running!');
  console.log(`[Pointy] Press ${CONFIG.hotkey} to ask a question`);
  console.log('[Pointy] Double-click the buddy to type a question');

  if (CONFIG.geminiApiKey) {
    console.log('[Pointy] ✅ Gemini Flash 2.5 ready (vision + reasoning)');
  } else {
    console.log('[Pointy] ⚠️  No GEMINI_API_KEY — running in demo mode');
    console.log('[Pointy]    Get a free key at: https://aistudio.google.com/apikey');
  }

  if (CONFIG.gnaniApiKey) {
    console.log('[Pointy] ✅ Gnani Prisma + Timbre ready (voice in/out)');
  } else {
    console.log('[Pointy] ⚠️  No GNANI_API_KEY — voice uses browser fallback');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault?.();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}
