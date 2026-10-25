const { app, BrowserWindow, Tray, Menu, ipcMain, screen, globalShortcut, nativeImage, session, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const screenshot = require('screenshot-desktop');

const LOG_FILE = path.join(__dirname, '../../pointy.log');
function logToFile(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(`[Pointy] ${msg}`);
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (_) {}
}

// Load environment variables from .env file if present
function loadEnv() {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    try {
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
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log('[Pointy] Loaded environment from .env');
    } catch (e) {
      console.warn('[Pointy] Notice loading .env:', e.message);
    }
  }
}
loadEnv();

const { GnaniService } = require('./services/gnani-service');
const { GeminiService } = require('./services/gemini-service');
const { AssemblyAIService } = require('./services/assemblyai-service');
const { GoogleTTSService } = require('./services/google-tts-service');
const { ConversationManager } = require('./services/conversation-manager');

// Ensure single instance to prevent hotkey conflicts
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (overlayWindow) {
      if (overlayWindow.isMinimized()) overlayWindow.restore();
      overlayWindow.focus();
      handleHotkeyPress();
    }
  });
}

// Keep references to prevent garbage collection
let overlayWindow = null;
let tray = null;
let assemblyaiService = null;
let gnaniService = null;
let geminiService = null;
let googleTtsService = null;
let conversationManager = null;
let appState = 'idle'; // idle | listening | thinking | pointing

// ─── App Configuration ───────────────────────────────────────────────
const CONFIG = {
  hotkey: 'Alt+C',
  assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY || '',
  gnaniApiKey: process.env.GNANI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY || '',
};

// ─── Create the transparent overlay window ───────────────────────────
function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  // Auto-allow microphone access without prompt
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') return true;
    return false;
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') return callback(true);
    return callback(false);
  });

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    enableLargerThanScreen: true,
    show: true,
    thickFrame: false,
    backgroundMaterial: 'none',
    backgroundColor: '#00000000',
    title: 'Pointy AI - Spatial Red Cursor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Pipe renderer console messages to terminal
  overlayWindow.webContents.on('console-message', (e, level, message) => {
    console.log(`[Overlay Console] ${message}`);
  });

  overlayWindow.once('ready-to-show', () => {
    // Force bounds to primaryDisplay.bounds so it fully overlays the Windows Taskbar
    overlayWindow.setBounds(primaryDisplay.bounds);
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.show();
    overlayWindow.moveTop();
    console.log('[Pointy] ✅ Overlay window covers full screen bounds:', overlayWindow.getBounds());

    // Delay click-through slightly so Windows DWM reliably paints the first frame
    setTimeout(() => {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      console.log('[Pointy] ✅ Click-through enabled');
    }, 400);

    // Trigger startup intro animation after window is ready
    setTimeout(() => {
      const cursorPoint = screen.getCursorScreenPoint();
      console.log(`[Pointy] 🚀 Triggering startup intro showcase at (${cursorPoint.x}, ${cursorPoint.y})`);
      overlayWindow?.webContents.send('startup-intro', cursorPoint);
    }, 600);
  });

  overlayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));

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
    { label: '🔴 Pointy AI - Red Spatial Cursor', enabled: false },
    { type: 'separator' },
    {
      label: '🎙️ Ask with Voice (Ctrl + Space / F8)',
      click: () => handleHotkeyPress(),
    },
    {
      label: '💬 Type a Question (Alt + T)',
      click: () => overlayWindow?.webContents.send('toggle-text-input'),
    },
    {
      label: '⚙️ Set API Keys...',
      click: () => promptApiKey(),
    },
    {
      label: '🔄 Reset to Standby (Esc)',
      click: () => resetState(),
    },
    { type: 'separator' },
    {
      label: 'Quit Pointy AI',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Pointy AI — Spatial Red AI Cursor (Ctrl + Space / F8)');
  tray.setContextMenu(contextMenu);
}

// Create a crimson red icon buffer for the tray
function createTrayIconBuffer(size) {
  const buffer = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt(Math.pow(x - size / 2, 2) + Math.pow(y - size / 2, 2));
      if (dist < size / 2 - 1) {
        buffer[idx] = 255;     // R (Vibrant Red)
        buffer[idx + 1] = 23;  // G
        buffer[idx + 2] = 68;  // B
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
  const hotkeys = [
    'Alt+C',
    'F8',
    'F9',
    'CommandOrControl+Alt+Space',
    'CommandOrControl+Shift+Space',
  ];

  hotkeys.forEach((hk) => {
    try {
      const registered = globalShortcut.register(hk, () => {
        console.log(`[Pointy] ⚡ Hotkey triggered: ${hk}`);
        handleHotkeyPress();
      });
      if (registered) {
        console.log(`[Pointy] ✅ Registered hotkey: ${hk}`);
      } else {
        console.warn(`[Pointy] ⚠️  Hotkey ${hk} could not be registered (in use by system)`);
      }
    } catch (e) {
      console.warn(`[Pointy] Error registering hotkey ${hk}:`, e.message);
    }
  });

  try {
    globalShortcut.register('Escape', () => {
      console.log('[Pointy] 🔄 Escape key pressed');
      resetState();
    });
    console.log('[Pointy] ✅ Registered hotkey: Escape');
  } catch (e) {
    console.warn('[Pointy] Notice: Escape hotkey registration:', e.message);
  }

  try {
    globalShortcut.register('Alt+T', () => {
      console.log('[Pointy] ⌨️ Alt+T triggered -> Opening text input');
      overlayWindow?.webContents.send('toggle-text-input');
    });
    console.log('[Pointy] ✅ Registered hotkey: Alt+T (Type question)');
  } catch (e) {
    console.warn('[Pointy] Notice: Alt+T registration:', e.message);
  }
}

// ─── Real-time Cursor Tracking (Follows original cursor when not in use) ──
let mouseTrackInterval = null;
let lastCursorPos = { x: -1, y: -1 };

function startMouseTracking() {
  if (mouseTrackInterval) return;

  const pt = screen.getCursorScreenPoint();
  lastCursorPos = pt;
  overlayWindow?.webContents.send('cursor-follow', pt);

  mouseTrackInterval = setInterval(() => {
    if (appState === 'listening' || appState === 'thinking') {
      const currentPt = screen.getCursorScreenPoint();
      if (currentPt.x !== lastCursorPos.x || currentPt.y !== lastCursorPos.y) {
        lastCursorPos = currentPt;
        overlayWindow?.webContents.send('cursor-follow', currentPt);
        overlayWindow?.moveTop();
      }
    }
  }, 16);
}

function stopMouseTracking() {
  if (mouseTrackInterval) {
    clearInterval(mouseTrackInterval);
    mouseTrackInterval = null;
  }
}

// ─── Handle the main hotkey press ────────────────────────────────────
async function handleHotkeyPress() {
  if (appState === 'listening') {
    console.log('[Pointy] Stop listening requested');
    appState = 'thinking';
    overlayWindow?.webContents.send('state-change', 'thinking');
    overlayWindow?.webContents.send('stop-recording');
    return;
  }

  if (appState !== 'idle') {
    resetState();
    return;
  }

  // Get current cursor location from mouse
  const cursorPoint = screen.getCursorScreenPoint();
  console.log(`[Pointy] 🔴 Popping out red cursor from mouse pos: (${cursorPoint.x}, ${cursorPoint.y})`);

  // Pop out the Red AI Cursor from the user's mouse position!
  overlayWindow?.webContents.send('pop-out-cursor', cursorPoint);

  // Start listening and continuously follow user's original cursor!
  appState = 'listening';
  startMouseTracking();
  overlayWindow?.webContents.send('state-change', 'listening');
  overlayWindow?.webContents.send('start-recording');
}

// ─── Screen Capture Engine (Hardware Accelerated with Fallback) ───────
async function captureScreenBuffer() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scale = primaryDisplay.scaleFactor || 1;

  // 1. Try Electron native desktopCapturer (GPU & DWM compositor direct capture)
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      },
    });

    if (sources && sources.length > 0) {
      const screenSource = sources.find((s) => s.id.includes('0:0') || s.name.toLowerCase().includes('entire') || s.name.toLowerCase().includes('screen 1')) || sources[0];
      const img = screenSource.thumbnail;
      if (!img.isEmpty()) {
        const jpegBuf = img.toJPEG(90);
        if (jpegBuf && jpegBuf.length > 1000) {
          logToFile(`📸 Screen captured via desktopCapturer (${jpegBuf.length} bytes, ${Math.round(width * scale)}x${Math.round(height * scale)})`);
          try {
            fs.writeFileSync(path.join(__dirname, '../../scratch/last-capture.jpg'), jpegBuf);
          } catch (_) {}
          return jpegBuf;
        }
      }
    }
  } catch (dcErr) {
    logToFile(`desktopCapturer notice: ${dcErr.message}`);
  }

  // 2. Fallback: screenshot-desktop
  try {
    const buf = await screenshot({ format: 'jpg' });
    if (buf && buf.length > 0) {
      logToFile(`📸 Screen captured via screenshot-desktop fallback (${buf.length} bytes)`);
      try {
        fs.writeFileSync(path.join(__dirname, '../../scratch/last-capture.jpg'), buf);
      } catch (_) {}
      return buf;
    }
  } catch (ssErr) {
    logToFile(`screenshot-desktop fallback notice: ${ssErr.message}`);
  }

  throw new Error('Screen capture failed');
}

// ─── Process the user's voice question ───────────────────────────────
async function processQuestion(audioBuffer) {
  try {
    appState = 'thinking';
    overlayWindow?.webContents.send('state-change', 'thinking');

    logToFile('⚡ Capturing screen and transcribing audio in parallel...');
    const [screenshotBuffer, sttResult] = await Promise.all([
      captureScreenBuffer(),
      (async () => {
        if (assemblyaiService && assemblyaiService.hasApiKey()) {
          logToFile(`🎙️ Transcribing audio (${audioBuffer?.length || 0} bytes) with AssemblyAI...`);
          return await assemblyaiService.transcribe(audioBuffer);
        } else if (gnaniService && gnaniService.hasApiKey()) {
          logToFile(`🎙️ Transcribing audio with Gnani Prisma...`);
          return await gnaniService.transcribe(audioBuffer);
        } else {
          logToFile('⚠️ No STT API key — using demo question');
          return { transcript: 'Where is the settings button?', language: 'en-US' };
        }
      })(),
    ]);

    const transcript = (sttResult?.transcript || '').trim();
    const detectedLang = sttResult?.language || 'en-US';

    if (!transcript) {
      logToFile('⚠️ No speech detected in audio stream');
      overlayWindow?.webContents.send('error', "I didn't catch that. Please ask again or press Alt+T to type!");
      setTimeout(() => {
        if (appState === 'thinking') {
          resetState();
        }
      }, 4000);
      return;
    }

    logToFile(`💬 User Transcript: "${transcript}" (${detectedLang})`);
    overlayWindow?.webContents.send('transcript', { text: transcript, lang: detectedLang });

    // Step 3: Send screenshot + question to Gemini
    await analyzeAndPoint(screenshotBuffer, transcript, detectedLang);

  } catch (error) {
    logToFile(`❌ Error processing voice question: ${error.message}`);
    overlayWindow?.webContents.send('error', error.message);
    setTimeout(() => {
      if (appState === 'thinking') {
        resetState();
      }
    }, 4500);
  }
}

// ─── Process a typed question ────────────────────────────────────────
async function processTypedQuestion(question) {
  try {
    appState = 'thinking';
    overlayWindow?.webContents.send('state-change', 'thinking');

    logToFile(`⌨️ Typed question: "${question}"`);
    const screenshotBuffer = await captureScreenBuffer();

    overlayWindow?.webContents.send('transcript', { text: question, lang: 'en-US' });

    // Send screenshot + question to Gemini
    await analyzeAndPoint(screenshotBuffer, question, 'en-US');

  } catch (error) {
    logToFile(`❌ Error processing typed question: ${error.message}`);
    overlayWindow?.webContents.send('error', error.message);
    setTimeout(() => {
      if (appState === 'thinking') {
        resetState();
      }
    }, 4500);
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

  // 1. Record user turn in persistent conversation memory
  conversationManager?.addMessage('user', question);
  const conversationHistory = conversationManager ? conversationManager.getGeminiHistory() : [];

  if (geminiService.hasApiKey()) {
    logToFile(`🧠 Asking Gemini model for: "${question}" (history turns: ${conversationHistory.length})`);
    result = await geminiService.analyzeScreen(screenshotBuffer, question, language, displayInfo, conversationHistory);
    logToFile(`✅ Gemini response: mode=${result.mode}, found=${result.found}, reply="${result.reply}", steps=${result.steps?.length || 0}`);
  } else {
    logToFile('⚠️ No GEMINI_API_KEY — using demo response');
    result = getDemoResponse(question);
  }

  // 2. Record assistant turn in persistent conversation memory
  conversationManager?.addMessage('assistant', result);
  const activeConv = conversationManager ? conversationManager.getActiveConversation() : null;

  // Synthesize speech using Google Cloud TTS ONLY (no other laggy TTS)
  let audioBase64 = null;
  if (result.reply && googleTtsService && googleTtsService.hasApiKey()) {
    logToFile('🔊 Synthesizing speech with Google Cloud TTS...');
    try {
      audioBase64 = await googleTtsService.speak(result.reply, result.reply_lang || language);
      logToFile(`🔊 TTS synthesis complete (${audioBase64 ? audioBase64.length : 0} bytes base64)`);
    } catch (ttsErr) {
      logToFile(`⚠️ Google Cloud TTS error: ${ttsErr.message}`);
    }
  }

  // Point at the target elements and start speaking simultaneously as cursor begins moving!
  appState = 'pointing';
  stopMouseTracking();
  overlayWindow?.moveTop();
  overlayWindow?.webContents.send('state-change', 'pointing');
  overlayWindow?.webContents.send('point-at', { result, audioBase64, conversation: activeConv, question });
}

// ─── Demo response when no API key is set ────────────────────────────
function getDemoResponse(question) {
  const q = (question || '').toLowerCase();
  const primaryDisplay = screen.getPrimaryDisplay();
  const sw = primaryDisplay.size.width;
  const sh = primaryDisplay.size.height;

  // Simulate finding UI elements based on common queries
  if (q.includes('setting') || q.includes('gear') || q.includes('config') || q.includes('option')) {
    return {
      found: true,
      reply: 'Here are the Settings! Look right here at this button.',
      reply_lang: 'en-US',
      steps: [{ x: sw - 85, y: 16, w: 44, h: 44, label: 'Settings', instruction: 'This is the Settings button right here.' }],
    };
  }
  if (q.includes('close') || q.includes('exit') || q.includes('quit')) {
    return {
      found: true,
      reply: 'Here is the Close button in the top-right corner.',
      reply_lang: 'en-US',
      steps: [{ x: sw - 48, y: 4, w: 46, h: 32, label: 'Close Window', instruction: 'Here is the Close button.' }],
    };
  }
  if (q.includes('search') || q.includes('find') || q.includes('google') || q.includes('query')) {
    return {
      found: true,
      reply: 'You can search right here! Type your query in this search field.',
      reply_lang: 'en-US',
      steps: [{ x: Math.round(sw / 2 - 160), y: 40, w: 320, h: 38, label: 'Search Field', instruction: 'Type your search query into this input.' }],
    };
  }
  if (q.includes('file') || q.includes('folder') || q.includes('explorer') || q.includes('menu')) {
    return {
      found: true,
      reply: 'Here is the File menu on the top-left.',
      reply_lang: 'en-US',
      steps: [{ x: 16, y: 32, w: 56, h: 30, label: 'File Menu', instruction: 'Click here to access files and folders.' }],
    };
  }
  if (q.includes('terminal') || q.includes('console') || q.includes('code') || q.includes('run')) {
    return {
      found: true,
      reply: 'Here is your terminal and workspace area.',
      reply_lang: 'en-US',
      steps: [{ x: 80, y: Math.round(sh - 220), w: 360, h: 140, label: 'Workspace / Terminal', instruction: 'Run commands or view output here.' }],
    };
  }

  // Check if user is asking for an explanation
  const isExplaining = q.includes('explain') || q.includes('why') || q.includes('how') || q.includes('what is') || q.includes('error') || q.includes('help');
  if (isExplaining) {
    return {
      mode: 'assistant',
      found: true,
      reply: `Here is the explanation for: ${question}. I've summarized the key insights on your screen!`,
      detailed_explanation: `### Pointy AI Assistant Analysis\n\n**Question:** "${question}"\n\n* **Overview:** Pointy AI acts as both your screen pointer and your inbuilt desktop AI assistant.\n* **Screen Context:** Analyzes all visible code, terminals, windows, and errors.\n* **Full Power:** Connect your **GEMINI_API_KEY** in \`.env\` for live real-time visual reasoning across all open applications!`,
      reply_lang: 'en-US',
      steps: [
        {
          x: Math.round(sw / 2 - 160),
          y: Math.round(sh / 2 - 80),
          w: 320,
          h: 120,
          label: 'Active Workspace',
          instruction: `Assisting with: "${question}"`
        }
      ],
    };
  }

  // General fallback pointing response
  return {
    mode: 'pointer',
    found: true,
    reply: `I heard: "${question}". Look right here, I've highlighted the solution for you!`,
    detailed_explanation: `Pointed at the target for "${question}". Set GEMINI_API_KEY in .env for full live screen reasoning!`,
    reply_lang: 'en-US',
    steps: [
      {
        x: Math.round(sw / 2 - 120),
        y: Math.round(sh / 2 - 40),
        w: 240,
        h: 70,
        label: 'Active Element',
        instruction: `Pointed at the target for "${question}".`
      }
    ],
  };
}

// ─── Reset to idle state ─────────────────────────────────────────────
function resetState() {
  appState = 'idle';
  stopMouseTracking();
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

  // Programmatic voice summon (from dock click or tray)
  ipcMain.on('trigger-voice-summon', () => {
    console.log('[Pointy] 🖱️ Voice summon triggered from UI dock click');
    handleHotkeyPress();
  });

  // Get current cursor location
  ipcMain.handle('get-cursor-position', () => {
    return screen.getCursorScreenPoint();
  });

  // Receive recorded audio from renderer
  ipcMain.on('audio-recorded', async (event, audioBase64) => {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    await processQuestion(audioBuffer);
  });

  // Receive typed or transcribed question
  ipcMain.on('typed-question', async (event, question) => {
    await processTypedQuestion(question);
  });

  // State management
  ipcMain.on('pointing-complete', () => {
    appState = 'idle';
    stopMouseTracking();
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
      const buf = await captureScreenBuffer();
      return buf.toString('base64');
    } catch (e) {
      logToFile(`Screenshot IPC error: ${e.message}`);
      return null;
    }
  });

  // Conversation Sessions & Memory
  ipcMain.handle('get-active-conversation', () => {
    return conversationManager ? conversationManager.getActiveConversation() : null;
  });

  ipcMain.handle('start-new-chat', () => {
    if (!conversationManager) return null;
    const newConv = conversationManager.startNewConversation();
    logToFile(`✨ Started new conversation session: ${newConv.id}`);
    overlayWindow?.webContents.send('conversation-updated', { conversation: newConv });
    return newConv;
  });

  ipcMain.handle('get-all-conversations', () => {
    return conversationManager ? conversationManager.getAllConversations() : [];
  });

  ipcMain.handle('switch-conversation', (event, id) => {
    if (!conversationManager) return null;
    const conv = conversationManager.setActiveConversation(id);
    logToFile(`🔄 Switched to conversation session: ${conv.id}`);
    overlayWindow?.webContents.send('conversation-updated', { conversation: conv });
    return conv;
  });
}

// ─── App lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Initialize services
  conversationManager = new ConversationManager();
  assemblyaiService = new AssemblyAIService(CONFIG.assemblyaiApiKey);
  gnaniService = new GnaniService(CONFIG.gnaniApiKey);
  geminiService = new GeminiService(CONFIG.geminiApiKey);
  googleTtsService = new GoogleTTSService(CONFIG.googleTtsApiKey);

  // Create overlay and tray
  createOverlayWindow();
  createTray();
  setupIPC();
  registerHotkeys();

  console.log('[Pointy] 🔴 Pointy AI - Spatial Red Cursor running!');
  console.log('[Pointy] 🎙️ Summon via: Alt+C OR F8 OR Ctrl+Space OR click the Red Cursor');
  console.log('[Pointy] 🎯 The Red AI Cursor pops out right from your mouse!');

  if (assemblyaiService.hasApiKey()) {
    console.log('[Pointy] ✅ AssemblyAI ready (Speech-to-Text)');
  } else if (gnaniService.hasApiKey()) {
    console.log('[Pointy] ✅ Gnani Prisma ready (Speech-to-Text)');
  } else {
    console.log('[Pointy] ℹ️  No STT key configured (set ASSEMBLYAI_API_KEY in .env)');
  }

  if (geminiService.hasApiKey()) {
    console.log('[Pointy] ✅ Gemini Vision & Reasoning model ready');
  } else {
    console.log('[Pointy] ⚠️  No GEMINI_API_KEY — running in demo mode');
    console.log('[Pointy]    Get a free key at: https://aistudio.google.com/apikey');
  }

  if (googleTtsService.hasApiKey()) {
    console.log('[Pointy] ✅ Google Cloud TTS ready');
  } else if (gnaniService.hasApiKey()) {
    console.log('[Pointy] ✅ Gnani Timbre ready (TTS voice output)');
  } else {
    console.log('[Pointy] ℹ️  TTS uses natural browser voice playback');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault?.();
});
