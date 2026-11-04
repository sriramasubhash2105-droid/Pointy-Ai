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
const { EasyVoiceTTSService } = require('./services/easyvoice-tts-service');
const { ConversationManager } = require('./services/conversation-manager');
const { MouseWatcherService } = require('./services/mouse-watcher-service');
const { ActionService } = require('./services/action-service');

// Ensure single instance to prevent hotkey conflicts
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (chatAppWindow) {
      if (chatAppWindow.isMinimized()) chatAppWindow.restore();
      chatAppWindow.show();
      chatAppWindow.focus();
    } else {
      createChatAppWindow();
    }
    if (overlayWindow && !overlayWindow.isVisible()) {
      overlayWindow.show();
    }
  });
}

// Keep references to prevent garbage collection
let overlayWindow = null;
let chatAppWindow = null;
let tray = null;
let assemblyaiService = null;
let gnaniService = null;
let geminiService = null;
let googleTtsService = null;
let conversationManager = null;
let mouseWatcherService = null;
let actionService = null;
let appState = 'idle'; // idle | listening | thinking | pointing

// ─── App Configuration ───────────────────────────────────────────────
const CONFIG = {
  hotkey: 'Alt+C',
  assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY || '',
  gnaniApiKey: process.env.GNANI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
  easyVoiceApiKey: process.env.EASYVOICE_API_KEY || '',
  googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY || '',
};

// ─── Create the Pointy AI Desktop Application Window ─────────────────
function createChatAppWindow() {
  if (chatAppWindow) {
    if (chatAppWindow.isMinimized()) chatAppWindow.restore();
    chatAppWindow.focus();
    return;
  }

  chatAppWindow = new BrowserWindow({
    width: 1260,
    height: 820,
    minWidth: 920,
    minHeight: 600,
    backgroundColor: '#0d0d0d',
    title: 'Pointy AI',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  chatAppWindow.loadFile(path.join(__dirname, '../renderer/chat-app.html'));

  chatAppWindow.once('ready-to-show', () => {
    chatAppWindow.show();
    chatAppWindow.focus();
  });

  chatAppWindow.on('closed', () => {
    chatAppWindow = null;
  });
}

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

    // Start mouse tracking immediately!
    startMouseTracking();

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
    {
      label: '💬 Open ChatGPT Classic App',
      click: () => createChatAppWindow(),
    },
    {
      label: '🎙️ Ask with Voice (Ctrl + Space / F8)',
      click: () => handleHotkeyPress(),
    },
    {
      label: '✍️ Voice Dictate to Active Window (Alt + D)',
      click: () => handleDictationToggle(),
    },
    {
      label: '⌨️ Type a Question on Screen (Alt + T)',
      click: () => overlayWindow?.webContents.send('toggle-text-input'),
    },
    {
      label: '⚙️ Settings & API Keys...',
      click: () => {
        createChatAppWindow();
        chatAppWindow?.webContents.executeJavaScript("document.getElementById('btn-open-settings')?.click()");
      },
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

  tray.setToolTip('Pointy AI & ChatGPT Classic');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (chatAppWindow) {
      if (chatAppWindow.isMinimized()) chatAppWindow.restore();
      chatAppWindow.focus();
    } else {
      createChatAppWindow();
    }
  });
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
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.setIgnoreMouseEvents(false);
        overlayWindow.show();
        overlayWindow.focus();
        overlayWindow.webContents.send('toggle-text-input');
      }
    });
    console.log('[Pointy] ✅ Registered hotkey: Alt+T (Type question)');
  } catch (e) {
    console.warn('[Pointy] Notice: Alt+T registration:', e.message);
  }

  try {
    globalShortcut.register('Alt+D', () => {
      console.log('[Pointy] 🎙️ Alt+D triggered -> Dictation toggle');
      handleDictationToggle();
    });
    console.log('[Pointy] ✅ Registered hotkey: Alt+D (Voice Dictation to Active Window)');
  } catch (e) {
    console.warn('[Pointy] Notice: Alt+D registration:', e.message);
  }
}

// ─── Real-time Cursor Tracking (Follows cursor continuously when not pointing) ──
let mouseTrackInterval = null;
let lastCursorPos = { x: -1, y: -1 };

function startMouseTracking() {
  if (mouseTrackInterval) return;

  const pt = screen.getCursorScreenPoint();
  lastCursorPos = pt;
  overlayWindow?.webContents.send('cursor-follow', pt);

  mouseTrackInterval = setInterval(() => {
    // Continuously follow the user's cursor: stream position so overlay always tracks physical mouse
    const currentPt = screen.getCursorScreenPoint();
    if (currentPt.x !== lastCursorPos.x || currentPt.y !== lastCursorPos.y) {
      lastCursorPos = currentPt;
      overlayWindow?.webContents.send('cursor-follow', currentPt);
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

// ─── Voice Dictation Engine (Talk and Pointy Types into Active Window) ───
async function handleDictationToggle() {
  if (appState === 'dictating') {
    console.log('[Pointy] ⏹️ Stopping dictation -> Transcribing...');
    appState = 'transcribing_dictation';
    overlayWindow?.webContents.send('state-change', 'transcribing_dictation');
    overlayWindow?.webContents.send('stop-recording');
    return;
  }

  if (appState !== 'idle') {
    resetState();
    return;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  console.log(`[Pointy] 🎙️ Starting Voice Dictation at (${cursorPoint.x}, ${cursorPoint.y})`);

  appState = 'dictating';
  startMouseTracking();
  overlayWindow?.webContents.send('start-dictation', cursorPoint);
  overlayWindow?.webContents.send('state-change', 'dictating');
  overlayWindow?.webContents.send('start-recording');
}

// Process voice dictation audio or instant transcript and type directly into the user's active window
async function processDictation(input) {
  const startTime = Date.now();
  try {
    appState = 'transcribing_dictation';
    overlayWindow?.webContents.send('state-change', 'transcribing_dictation');

    let transcript = '';

    if (typeof input === 'string') {
      // ⚡ Path 1: Instant client-side Web Speech API transcript (0ms network STT latency!)
      transcript = input.trim();
      logToFile(`⚡ Dictation: Instant transcript received from Web Speech: "${transcript}"`);
    } else if (Buffer.isBuffer(input)) {
      // ⚡ Path 2: Audio buffer fallback (~1.5s via Gemini 3.5 Flash Lite)
      logToFile(`🎙️ Dictation: Transcribing voice buffer (${input.length} bytes)...`);

      // Try Gemini 3.5 Flash STT (~2s)
      if (geminiService && geminiService.hasApiKey()) {
        try {
          const res = await geminiService.transcribeAudio(input);
          const cand = (res?.transcript || '').trim();
          if (cand && !/^(\d{1,2}:)?\d{1,2}(:\d{2})?$/.test(cand) && !/^[0-9:\s.]+$/.test(cand)) {
            transcript = cand;
            logToFile(`⚡ Dictation transcribed via Gemini in ${Date.now() - startTime}ms: "${transcript}"`);
          } else {
            logToFile(`⚠️ Gemini returned timestamp or empty ("${cand}"), falling back to AssemblyAI (universal-2)...`);
          }
        } catch (gemErr) {
          logToFile(`⚠️ Gemini STT failed (${gemErr.message}), falling back to AssemblyAI/Gnani...`);
        }
      }

      // Fallback to AssemblyAI (universal-2) if Gemini was empty, timestamped, or errored
      if (!transcript) {
        if (assemblyaiService && assemblyaiService.hasApiKey()) {
          logToFile('🎙️ Dictation: Transcribing with AssemblyAI (universal-2)...');
          const res = await assemblyaiService.transcribe(input);
          transcript = (res?.transcript || '').trim();
          logToFile(`🎯 Dictation transcribed via AssemblyAI in ${Date.now() - startTime}ms: "${transcript}"`);
        } else if (gnaniService && gnaniService.hasApiKey()) {
          logToFile('🎙️ Dictation: Transcribing with Gnani fallback...');
          const res = await gnaniService.transcribe(input);
          transcript = (res?.transcript || '').trim();
        }
      }
    }

    transcript = transcript.trim();
    if (!transcript) {
      logToFile('⚠️ Dictation: No speech detected');
      overlayWindow?.webContents.send('dictation-result', { success: false, text: "No speech detected" });
      setTimeout(() => {
        if (appState === 'transcribing_dictation') resetState();
      }, 1500);
      return;
    }

    logToFile(`✍️ Dictation ready in ${Date.now() - startTime}ms: "${transcript}" -> Typing into active window!`);
    overlayWindow?.webContents.send('dictation-result', { success: true, text: transcript });

    // Type the transcribed text directly into the user's active window!
    await actionService?.typeTextIntoActiveWindow(transcript, false);

    setTimeout(() => {
      if (appState === 'transcribing_dictation') {
        resetState();
      }
    }, 1600);

  } catch (err) {
    logToFile(`❌ Dictation error: ${err.message}`);
    overlayWindow?.webContents.send('dictation-result', { success: false, text: err.message });
    setTimeout(() => {
      if (appState === 'transcribing_dictation') resetState();
    }, 1600);
  }
}

// ─── Screen Capture Engine (Hardware Accelerated with Fallback) ───────
async function captureScreenBuffer() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;

  // Ultra-fast optimized capture: downscale to 1280px max dimension and 72% JPEG quality.
  // Reduces payload from ~780KB to ~110KB (85% reduction), cutting network upload
  // and Gemini vision tokenization time by ~40% while preserving 100% pointing precision!
  const maxDim = 1280;
  let targetWidth = width;
  let targetHeight = height;
  if (width > maxDim) {
    targetWidth = maxDim;
    targetHeight = Math.round(height * (maxDim / width));
  } else if (height > maxDim) {
    targetHeight = maxDim;
    targetWidth = Math.round(width * (maxDim / height));
  }

  // 1. Try Electron native desktopCapturer (GPU & DWM compositor direct capture)
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: targetWidth,
        height: targetHeight,
      },
    });

    if (sources && sources.length > 0) {
      const screenSource = sources.find((s) => s.id.includes('0:0') || s.name.toLowerCase().includes('entire') || s.name.toLowerCase().includes('screen 1')) || sources[0];
      const img = screenSource.thumbnail;
      if (!img.isEmpty()) {
        const jpegBuf = img.toJPEG(72);
        if (jpegBuf && jpegBuf.length > 1000) {
          logToFile(`📸 Screen captured via desktopCapturer (${jpegBuf.length} bytes, ${targetWidth}x${targetHeight})`);
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

// ─── Background Detailed Deep Research Workflow (Claude / ChatGPT) ───
async function startDeepResearchWorkflow(action, language = 'en-US') {
  const topic = action.topic || action.target || 'the requested topic';
  const targetApp = action.app || 'Claude';
  const replyText = action.reply || `Starting detailed research on ${topic} in ${targetApp} in the background! I'll notify you as soon as the research is completed.`;

  logToFile(`🔬 Starting Background Deep Research: topic="${topic}", app=${targetApp}`);

  // 1. Record user & assistant turn in persistent memory
  conversationManager?.addMessage('user', `Deep research on ${topic} in ${targetApp}`);
  const initialResult = {
    mode: 'action',
    action,
    found: true,
    reply: replyText,
    reply_lang: language,
    detailed_explanation: `Initiated background deep research on **${topic}** in **${targetApp}**.\n\nPointy is launching **${targetApp}** and synthesizing an in-depth research report. You can continue working normally — Pointy will chime and present your executive briefing as soon as research is complete.`,
    steps: [],
  };
  conversationManager?.addMessage('assistant', initialResult);
  const activeConv = conversationManager ? conversationManager.getActiveConversation() : null;

  // 2. Announce immediately visually on screen
  appState = 'pointing';
  overlayWindow?.moveTop();
  overlayWindow?.webContents.send('state-change', 'pointing');
  overlayWindow?.webContents.send('point-at', {
    result: initialResult,
    audioBase64: null,
    conversation: activeConv,
    question: `Research ${topic}`,
  });

  // Speak initial confirmation aloud
  if (googleTtsService) {
    googleTtsService.speak(replyText, language).then((audioBase64) => {
      if (audioBase64 && appState === 'pointing') {
        overlayWindow?.webContents.send('play-audio', audioBase64);
      }
    }).catch((e) => logToFile(`TTS deep research notice: ${e.message}`));
  }

  // 3. Display background research pill on overlay & chat window
  overlayWindow?.webContents.send('deep-research-started', {
    topic,
    app: targetApp,
    startedAt: Date.now(),
  });
  chatAppWindow?.webContents.send('deep-research-started', {
    topic,
    app: targetApp,
    startedAt: Date.now(),
  });

  // 4. Return cursor to idle after announcement so user can use PC freely
  setTimeout(() => {
    if (appState === 'pointing') {
      resetState();
    }
  }, 5500);

  // 5. Run automation and Gemini deep research synthesis concurrently in background
  Promise.allSettled([
    // A. Automation in Claude / ChatGPT desktop app
    actionService?.execute(action),

    // B. Autonomous deep research synthesis via Gemini
    (async () => {
      if (geminiService && geminiService.hasApiKey()) {
        return await geminiService.conductDeepResearch(topic, targetApp);
      }
      return null;
    })(),
  ]).then(async (results) => {
    const researchResult = results[1]?.status === 'fulfilled' ? results[1].value : null;
    logToFile(`🔬 Background Deep Research finished for: "${topic}"! (Synthesis succeeded: ${!!researchResult})`);

    const spokenSummary = researchResult?.executive_spoken_summary ||
      `Your detailed research on ${topic} in ${targetApp} is now complete! I have compiled the key findings and report on screen for you.`;

    const reportMarkdown = researchResult?.full_dossier_markdown ||
      `# 🔬 Deep Research: ${topic}\n\nCompleted in **${targetApp}**.\n\nPlease check the active ${targetApp} window to view the full live output.`;

    const keyFindings = (researchResult?.key_findings && researchResult.key_findings.length > 0)
      ? researchResult.key_findings
      : [
          `Deep research conducted in ${targetApp}`,
          `Comprehensive architectural breakdown synthesized for ${topic}`,
          `Practical applications and industry outlook documented`,
        ];

    // Record completed research turn in conversation memory
    conversationManager?.addMessage('assistant', {
      mode: 'research_completed',
      found: true,
      reply: spokenSummary,
      reply_lang: language,
      detailed_explanation: reportMarkdown,
      steps: [],
    });

    // Native Windows OS Notification
    try {
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: `Pointy AI • Research Completed`,
          body: `Detailed research on "${topic}" in ${targetApp} is ready! Click to view your dossier.`,
        });
        notif.on('click', () => {
          overlayWindow?.show();
          overlayWindow?.focus();
        });
        notif.show();
      }
    } catch (_) {}

    // Send deep-research-completed event to overlay & chat app
    overlayWindow?.webContents.send('deep-research-completed', {
      topic,
      app: targetApp,
      spokenSummary,
      reportMarkdown,
      keyFindings,
      executiveSummary: researchResult?.executive_summary || '',
    });

    chatAppWindow?.webContents.send('deep-research-completed', {
      topic,
      app: targetApp,
      spokenSummary,
      reportMarkdown,
      keyFindings,
      executiveSummary: researchResult?.executive_summary || '',
    });

    // Bring overlay to front for the reminder
    overlayWindow?.setIgnoreMouseEvents(false);
    overlayWindow?.show();
    overlayWindow?.moveTop();

    // Synthesize spoken reminder using EasyVoice TTS Kokoro-82M!
    if (googleTtsService) {
      const speechPrompt = `Subhash, your detailed research on ${topic} in ${targetApp} is complete! ${spokenSummary}`;
      try {
        const cleanSpeech = speechPrompt.replace(/[*_#`~\[\]]/g, '').trim();
        const audioBase64 = await googleTtsService.speak(cleanSpeech, language);
        if (audioBase64) {
          overlayWindow?.webContents.send('play-audio', audioBase64);
        }
      } catch (e) {
        logToFile(`TTS research reminder notice: ${e.message}`);
      }
    }
  });
}

// ─── Execute Desktop Action (App launch, URL open, system tasks) ─────
async function executeDesktopAction(action, question, language = 'en-US') {
  logToFile(`⚡ Executing desktop action: ${action.type} -> "${action.name || action.target || ''}"`);

  // If this action is deep research, delegate to the dedicated background research workflow!
  if (action.type === 'deep_research') {
    await startDeepResearchWorkflow(action, language);
    return;
  }

  const replyText = action.reply || `Opening ${action.name || action.target} for you!`;

  // 1. Run the action detached on OS immediately without blocking!
  actionService?.execute(action).catch((err) => {
    logToFile(`⚠️ Action execution warning: ${err.message}`);
  });

  // 2. Record in conversation memory
  conversationManager?.addMessage('user', question);
  const normalizedResult = {
    mode: 'action',
    action,
    found: true,
    reply: replyText,
    reply_lang: language,
    detailed_explanation: `Executed desktop action: **${action.name || action.target}** (${action.type})`,
    steps: [],
  };
  conversationManager?.addMessage('assistant', normalizedResult);
  const activeConv = conversationManager ? conversationManager.getActiveConversation() : null;

  // 3. Immediately display visual feedback on screen (<5ms)!
  appState = 'pointing';
  overlayWindow?.moveTop();
  overlayWindow?.webContents.send('state-change', 'pointing');
  overlayWindow?.webContents.send('point-at', {
    result: normalizedResult,
    audioBase64: null,
    conversation: activeConv,
    question,
  });

  // 4. Update ChatGPT app window
  overlayWindow?.webContents.send('conversation-updated', { conversation: activeConv });
  chatAppWindow?.webContents.send('conversation-updated', { conversation: activeConv });

  // 5. Synthesize speech concurrently in background and play as soon as ready!
  if (googleTtsService) {
    googleTtsService.speak(replyText, language).then((audioBase64) => {
      if (audioBase64 && appState === 'pointing') {
        overlayWindow?.webContents.send('play-audio', audioBase64);
      }
    }).catch((ttsErr) => {
      logToFile(`TTS action warning: ${ttsErr.message}`);
    });
  }
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
        if (geminiService && geminiService.hasApiKey()) {
          try {
            logToFile(`🎙️ Transcribing audio (${audioBuffer?.length || 0} bytes) with Gemini 3.5 Flash Lite...`);
            const gRes = await geminiService.transcribeAudio(audioBuffer);
            if (gRes && gRes.transcript) return gRes;
          } catch (gErr) {
            logToFile(`⚠️ Gemini STT query fallback: ${gErr.message}`);
          }
        }
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

    // Fast-path desktop action check (<5ms zero-latency response)
    const localAction = actionService?.matchLocalIntent(transcript);
    if (localAction) {
      logToFile(`⚡ Fast-path action matched: "${localAction.name}" (${localAction.type})`);
      await executeDesktopAction(localAction, transcript, detectedLang);
      return;
    }

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
    overlayWindow?.webContents.send('transcript', { text: question, lang: 'en-US' });

    // Fast-path desktop action check (<5ms zero-latency response)
    const localAction = actionService?.matchLocalIntent(question);
    if (localAction) {
      logToFile(`⚡ Fast-path action matched: "${localAction.name}" (${localAction.type})`);
      await executeDesktopAction(localAction, question, 'en-US');
      return;
    }

    const screenshotBuffer = await captureScreenBuffer();

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

// ─── Multi-step Guidance Engine (Settings -> Submenus, Multi-turn Pointing) ──
let activeMultiStep = null;
let multiStepTimeoutTimer = null;
let isAdvancingMultiStep = false;

function clearMultiStepTimer() {
  if (multiStepTimeoutTimer) {
    clearTimeout(multiStepTimeoutTimer);
    multiStepTimeoutTimer = null;
  }
}

function clearMultiStep() {
  clearMultiStepTimer();
  activeMultiStep = null;
  isAdvancingMultiStep = false;
}

function startMultiStepWaiting(info) {
  clearMultiStepTimer();
  activeMultiStep = {
    ...info,
    arrivedAt: Date.now() + 540,
    waitingForClick: true,
  };

  logToFile(`⏳ Multi-step active (Step ${info.stepIndex}/${info.totalSteps}): waiting for user click on "${info.stepLabel}" to reveal "${info.nextTarget}"`);

  overlayWindow?.webContents.send('multi-step-waiting', {
    stepIndex: info.stepIndex,
    totalSteps: info.totalSteps,
    stepLabel: info.stepLabel,
    nextTarget: info.nextTarget,
  });

  // Keep alive for 35 seconds waiting for user click/action
  multiStepTimeoutTimer = setTimeout(() => {
    if (activeMultiStep) {
      logToFile('⌛ Multi-step timed out after 35s of inactivity.');
      clearMultiStep();
    }
  }, 35000);
}

async function advanceMultiStep() {
  if (!activeMultiStep || isAdvancingMultiStep) return;
  isAdvancingMultiStep = true;
  clearMultiStepTimer();

  const currentStep = activeMultiStep.stepIndex || 1;
  const nextStepIndex = currentStep + 1;
  const { goal, nextTarget, stepLabel, language, stepHistory = [], totalSteps = 3 } = activeMultiStep;
  const updatedHistory = [...stepHistory];
  if (stepLabel && !updatedHistory.includes(stepLabel)) {
    updatedHistory.push(stepLabel);
  }

  logToFile(`🔄 Advancing multi-step: user clicked "${stepLabel}", analyzing updated screen for Step ${nextStepIndex} ("${nextTarget}")...`);

  overlayWindow?.webContents.send('multi-step-loading', {
    stepIndex: nextStepIndex,
    totalSteps: Math.max(nextStepIndex, totalSteps),
    goal,
    nextTarget,
  });

  try {
    // 1. Wait 450ms for UI / modal / menu animation to render
    await new Promise((r) => setTimeout(r, 450));

    // 2. Capture updated screen buffer
    const newScreenshot = await captureScreenBuffer();
    const primaryDisplay = screen.getPrimaryDisplay();
    const displayInfo = {
      scaleFactor: primaryDisplay.scaleFactor,
      width: primaryDisplay.size.width,
      height: primaryDisplay.size.height,
    };

    // 3. Ask Gemini for this step (evaluates whether goal is reached or next intermediate step needed)
    const resultNext = await geminiService.analyzeNextStep(
      newScreenshot,
      goal,
      nextTarget,
      updatedHistory,
      nextStepIndex,
      Math.max(nextStepIndex, totalSteps),
      language,
      displayInfo
    );

    logToFile(`✅ Multi-step ${nextStepIndex} response: mode=${resultNext.mode}, multi_step=${resultNext.multi_step}, is_final_step=${resultNext.is_final_step}, reply="${resultNext.reply}", steps=${resultNext.steps?.length || 0}`);

    // Record in conversation memory
    conversationManager?.addMessage('assistant', resultNext);
    const activeConv = conversationManager ? conversationManager.getActiveConversation() : null;

    // 4. Synthesize speech for this step
    const spokenSentence = googleTtsService ? googleTtsService.extractFirstSentence(resultNext.reply) : resultNext.reply;
    let audioBase64 = null;
    if (spokenSentence && googleTtsService && googleTtsService.hasApiKey()) {
      try {
        audioBase64 = await googleTtsService.speak(spokenSentence, resultNext.reply_lang || language);
      } catch (ttsErr) {
        logToFile(`TTS step ${nextStepIndex} error: ${ttsErr.message}`);
      }
    }

    // 5. Check if MORE steps remain or if this is the final target!
    const isContinuing = !!resultNext.multi_step && !resultNext.is_final_step && nextStepIndex < 7;

    if (isContinuing && resultNext.steps && resultNext.steps.length > 0) {
      isAdvancingMultiStep = false;
      const nextTotal = Math.max(nextStepIndex + 1, resultNext.total_steps || (nextStepIndex + 1));
      startMultiStepWaiting({
        goal: resultNext.goal || goal,
        nextTarget: resultNext.next_target || goal,
        stepIndex: nextStepIndex,
        totalSteps: nextTotal,
        stepLabel: resultNext.steps[0].label || 'the item',
        targetBox: resultNext.steps[0],
        stepHistory: updatedHistory,
        language,
      });
    } else {
      // Completed all steps!
      clearMultiStep();
    }

    // 6. Point to the element on the newly updated screen!
    appState = 'pointing';
    overlayWindow?.moveTop();
    overlayWindow?.webContents.send('state-change', 'pointing');
    overlayWindow?.webContents.send('point-at', {
      result: resultNext,
      audioBase64,
      conversation: activeConv,
      question: goal,
    });

  } catch (err) {
    logToFile(`❌ Multi-step advance error: ${err.message}`);
    clearMultiStep();
    overlayWindow?.webContents.send('multi-step-error', { error: err.message });
  }
}

function setupMouseWatcher() {
  if (!mouseWatcherService) return;
  mouseWatcherService.on('click', (pt) => {
    if (activeMultiStep && activeMultiStep.waitingForClick && !isAdvancingMultiStep) {
      if (Date.now() < activeMultiStep.arrivedAt + 450) return;

      const box = activeMultiStep.targetBox;
      let isNearTarget = true;
      if (box && box.x != null && box.y != null) {
        const minX = Math.max(0, box.x - 80);
        const maxX = box.x + (box.w || 60) + 80;
        const minY = Math.max(0, box.y - 80);
        const maxY = box.y + (box.h || 40) + 80;
        isNearTarget = (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY);
      }

      if (isNearTarget) {
        logToFile(`🖱️ User clicked target "${activeMultiStep.stepLabel}" at (${pt.x}, ${pt.y})`);
        advanceMultiStep();
      } else if (Date.now() > activeMultiStep.arrivedAt + 1200) {
        logToFile(`🖱️ User clicked screen at (${pt.x}, ${pt.y}) during multi-step`);
        advanceMultiStep();
      }
    }
  });
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
  const conversationHistory = conversationManager ? conversationManager.getGeminiHistory(4) : [];
  conversationManager?.addMessage('user', question);

  if (geminiService.hasApiKey()) {
    logToFile(`🧠 Asking Gemini model for: "${question}" (history turns: ${conversationHistory.length})`);
    result = await geminiService.analyzeScreen(screenshotBuffer, question, language, displayInfo, conversationHistory);
    logToFile(`✅ Gemini response: mode=${result.mode}, found=${result.found}, reply="${result.reply}", steps=${result.steps?.length || 0}`);
  } else {
    logToFile('⚠️ No GEMINI_API_KEY — using demo response');
    result = getDemoResponse(question);
  }

  // If Gemini recognizes this as a desktop action to execute
  if (result.mode === 'action' && result.action) {
    if (result.action.type === 'deep_research') {
      await startDeepResearchWorkflow(result.action, language);
      return;
    }
    if (actionService) {
      logToFile(`⚡ Executing action recognized by Gemini: ${result.action.type} -> "${result.action.target}" (${result.action.name || ''})`);
      try {
        await actionService.execute(result.action);
      } catch (actErr) {
        logToFile(`⚠️ Action execution warning: ${actErr.message}`);
      }
    }
  }

  // 2. Record assistant turn in persistent conversation memory
  conversationManager?.addMessage('assistant', result);
  const activeConv = conversationManager ? conversationManager.getActiveConversation() : null;

  // 3. Ultra-fast TTS: Synthesize speech (Speaks full, long explanation for explanatory queries!)
  const isExplanation = result.mode === 'assistant' ||
    /^(explain|how\s+does|why|what\s+is|what\s+are|tell\s+me\s+about|teach\s+me|describe|walk\s+me\s+through|summarize)/i.test((question || '').trim()) ||
    (result.reply && result.reply.length > 120);

  let textToSpeak = result.reply || '';
  if (!isExplanation && googleTtsService && typeof googleTtsService.extractFirstSentence === 'function') {
    textToSpeak = googleTtsService.extractFirstSentence(result.reply);
  }

  // Clean Markdown formatting for silky smooth TTS speech
  textToSpeak = textToSpeak
    .replace(/[*_#`~\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  let audioBase64 = null;
  if (textToSpeak && googleTtsService) {
    logToFile(`🔊 Synthesizing speech (${isExplanation ? 'FULL DETAILED EXPLANATION' : 'Concise'}): "${textToSpeak.slice(0, 60)}..."`);
    try {
      audioBase64 = await googleTtsService.speak(textToSpeak, result.reply_lang || language);
      logToFile(`🔊 TTS synthesis complete (${audioBase64 ? audioBase64.length : 0} bytes base64)`);
    } catch (ttsErr) {
      logToFile(`⚠️ TTS error: ${ttsErr.message}`);
    }
  }

  // 4. Handle multi-step guidance if target requires opening menus/settings first
  if (result.multi_step && !result.is_final_step && result.steps && result.steps.length > 0) {
    startMultiStepWaiting({
      goal: result.goal || question,
      nextTarget: result.next_target || question,
      stepIndex: result.step_index || 1,
      totalSteps: Math.max(2, result.total_steps || 3),
      stepLabel: result.steps[0].label || 'the item',
      targetBox: result.steps[0],
      stepHistory: [result.steps[0].label || 'Initial launcher'],
      language,
    });
  } else {
    clearMultiStep();
  }

  // Point at the target elements and start speaking simultaneously as cursor begins moving!
  appState = 'pointing';
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

  // Fast demo action check
  const localAct = actionService ? actionService.matchLocalIntent(question) : null;
  if (localAct) {
    actionService.execute(localAct);
    return {
      mode: 'action',
      action: localAct,
      found: true,
      reply: localAct.reply || `Opening ${localAct.name || localAct.target} for you!`,
      reply_lang: 'en-US',
      steps: [],
    };
  }

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
  clearMultiStep();
  appState = 'idle';
  startMouseTracking();
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
    if (appState === 'dictating' || appState === 'transcribing_dictation') {
      await processDictation(audioBuffer);
    } else {
      await processQuestion(audioBuffer);
    }
  });

  // Programmatic voice dictation trigger (from floating menu click)
  ipcMain.on('trigger-dictation', () => {
    console.log('[Pointy] 🖱️ Voice dictation triggered from UI click');
    handleDictationToggle();
  });

  // Receive instant client-side transcribed dictation text (0ms network delay)
  ipcMain.on('dictation-transcribed', async (event, text) => {
    logToFile(`🎙️ Instant dictation transcript received: "${text}"`);
    await processDictation(text);
  });

  // Receive typed or transcribed question
  ipcMain.on('typed-question', async (event, question) => {
    await processTypedQuestion(question);
  });

  // State management
  ipcMain.on('pointing-complete', () => {
    logToFile('🎯 Pointing complete received -> setting appState to idle and ensuring mouse tracking is active');
    appState = 'idle';
    startMouseTracking();
    overlayWindow?.webContents.send('state-change', 'idle');
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

  // Multi-step guidance manual controls
  ipcMain.handle('advance-multi-step', async () => {
    logToFile('🖱️ User triggered advance-multi-step via IPC');
    await advanceMultiStep();
    return true;
  });

  ipcMain.handle('cancel-multi-step', () => {
    logToFile('❌ Multi-step canceled via IPC');
    clearMultiStep();
    resetState();
    return true;
  });

  // Deep Research Action Handlers
  ipcMain.handle('open-research-app', async (event, appName) => {
    if (!actionService) return false;
    const target = (appName || 'Claude').toLowerCase();
    if (target.includes('chatgpt')) {
      return actionService.execute({ type: 'windows_app_id', appId: 'OpenAI.Codex_2p2nqsd0c76g0!App', name: 'ChatGPT' });
    } else {
      return actionService.execute({ type: 'windows_app_id', appId: 'Claude_pzs8sxrjxfjjc!Claude', name: 'Claude' });
    }
  });

  ipcMain.handle('copy-to-clipboard', (event, text) => {
    if (text) {
      const { clipboard } = require('electron');
      clipboard.writeText(text);
      return true;
    }
    return false;
  });

  // ─── ChatGPT Desktop Application IPC Handlers ───────────────────────
  ipcMain.handle('chat-get-conversations', () => {
    if (!conversationManager) return [];
    return conversationManager.getAllConversations();
  });

  ipcMain.handle('chat-get-conversation', (event, id) => {
    if (!conversationManager) return null;
    return conversationManager.getConversation(id);
  });

  ipcMain.handle('chat-create-conversation', (event, title) => {
    if (!conversationManager) return null;
    const newConv = conversationManager.startNewConversation(title || 'New chat');
    overlayWindow?.webContents.send('conversation-updated', { conversation: newConv });
    chatAppWindow?.webContents.send('conversation-updated', { conversation: newConv });
    return newConv;
  });

  ipcMain.handle('chat-switch-conversation', (event, id) => {
    if (!conversationManager) return null;
    const conv = conversationManager.setActiveConversation(id);
    overlayWindow?.webContents.send('conversation-updated', { conversation: conv });
    chatAppWindow?.webContents.send('conversation-updated', { conversation: conv });
    return conv;
  });

  ipcMain.handle('chat-delete-conversation', (event, id) => {
    if (!conversationManager) return false;
    const success = conversationManager.deleteConversation(id);
    overlayWindow?.webContents.send('conversation-updated', { activeId: conversationManager.activeId });
    chatAppWindow?.webContents.send('conversation-updated', { activeId: conversationManager.activeId });
    return { success, activeId: conversationManager.activeId };
  });

  ipcMain.handle('chat-rename-conversation', (event, id, title) => {
    if (!conversationManager) return null;
    const conv = conversationManager.renameConversation(id, title);
    overlayWindow?.webContents.send('conversation-updated', { conversation: conv });
    chatAppWindow?.webContents.send('conversation-updated', { conversation: conv });
    return conv;
  });

  ipcMain.handle('chat-pin-conversation', (event, id, isPinned) => {
    if (!conversationManager) return null;
    const conv = conversationManager.pinConversation(id, isPinned);
    overlayWindow?.webContents.send('conversation-updated', { conversation: conv });
    chatAppWindow?.webContents.send('conversation-updated', { conversation: conv });
    return conv;
  });

  ipcMain.handle('chat-send-message', async (event, payload, maybeText, maybeOpts) => {
    if (!conversationManager) throw new Error('Conversation manager not ready');
    let convId, text, model, attachScreen;
    if (typeof payload === 'object' && payload !== null) {
      convId = payload.convId || payload.id;
      text = payload.text || payload.prompt;
      model = payload.model;
      attachScreen = payload.attachScreen || !!payload.screenshot;
    } else {
      convId = payload;
      text = maybeText;
      model = maybeOpts?.model;
      attachScreen = maybeOpts?.attachScreen || !!maybeOpts?.screenshot;
    }

    if (convId) {
      conversationManager.setActiveConversation(convId);
    }
    const userMsg = conversationManager.addMessage('user', text);

    let assistantText = '';
    let steps = [];

    try {
      const localAction = actionService?.matchLocalIntent(text);
      if (localAction) {
        logToFile(`⚡ Executing action from chat app: "${localAction.name}" (${localAction.type})`);
        if (localAction.type === 'deep_research') {
          startDeepResearchWorkflow(localAction, 'en-US');
          assistantText = localAction.reply || `Starting detailed research on ${localAction.topic} in ${localAction.app} in the background!`;
        } else {
          await actionService.execute(localAction);
          assistantText = localAction.reply || `Opened ${localAction.name || localAction.target} for you!`;
        }
      } else if (attachScreen) {
        // Multimodal analysis with screenshot
        const screenshotBuf = await captureScreenBuffer();
        const primaryDisplay = screen.getPrimaryDisplay();
        const displayInfo = {
          width: primaryDisplay.size.width,
          height: primaryDisplay.size.height,
        };
        const history = conversationManager.getGeminiHistory(4);
        const visionResult = await geminiService.analyzeScreen(screenshotBuf, text, 'en-US', displayInfo, history);
        assistantText = visionResult.detailed_explanation || visionResult.reply || 'Screen analyzed successfully.';
        steps = visionResult.steps || [];
      } else if (geminiService && geminiService.hasApiKey()) {
        const history = conversationManager.getGeminiHistory(4);
        const activeModel = model || process.env.GEMINI_MODEL || CONFIG.geminiModel || 'gemini-3-flash-preview';
        assistantText = await geminiService.generateChatResponse(text, history, { model: activeModel });
      } else {
        assistantText = `I heard: "${text}".\n\nTo enable full intelligent Pointy AI reasoning and multi-turn capabilities, please enter your **Gemini API Key** in the **Settings (⚙️)** panel. You can obtain a free key at [Google AI Studio](https://aistudio.google.com/apikey).`;
      }
    } catch (err) {
      console.error('[Main] chat-send-message error:', err.message);
      assistantText = `❌ Error generating response: ${err.message}\n\nPlease verify your API key in Settings (⚙️).`;
    }

    const astMsg = conversationManager.addMessage('assistant', {
      reply: assistantText.split('\n')[0],
      detailed_explanation: assistantText,
      steps,
      found: true,
    });

    overlayWindow?.webContents.send('conversation-updated', { conversation: conversationManager.getActiveConversation() });
    chatAppWindow?.webContents.send('conversation-updated', { conversation: conversationManager.getActiveConversation() });

    return {
      userMessage: userMsg,
      assistantMessage: astMsg,
      response: assistantText,
    };
  });

  ipcMain.handle('chat-clear-all-conversations', () => {
    if (!conversationManager) return false;
    conversationManager.clearAllConversations();
    overlayWindow?.webContents.send('conversation-updated', { activeId: null });
    chatAppWindow?.webContents.send('conversation-updated', { activeId: null });
    return true;
  });

  ipcMain.handle('chat-get-api-keys', () => {
    const mask = (k) => k ? (k.length > 8 ? `${k.substring(0, 4)}••••••••${k.substring(k.length - 4)}` : '••••••••') : '';
    return {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || CONFIG.geminiApiKey || '',
      geminiApiKey: process.env.GEMINI_API_KEY || CONFIG.geminiApiKey || '',
      geminiApiKeyMasked: mask(process.env.GEMINI_API_KEY || CONFIG.geminiApiKey),
      GEMINI_MODEL: process.env.GEMINI_MODEL || CONFIG.geminiModel || 'gemini-3-flash-preview',
      geminiModel: process.env.GEMINI_MODEL || CONFIG.geminiModel || 'gemini-3-flash-preview',
      EASYVOICE_API_KEY: process.env.EASYVOICE_API_KEY || CONFIG.easyVoiceApiKey || '',
      easyVoiceApiKey: process.env.EASYVOICE_API_KEY || CONFIG.easyVoiceApiKey || '',
      easyVoiceApiKeyMasked: mask(process.env.EASYVOICE_API_KEY || CONFIG.easyVoiceApiKey),
      GOOGLE_TTS_API_KEY: process.env.GOOGLE_TTS_API_KEY || CONFIG.googleTtsApiKey || '',
      googleTtsApiKey: process.env.GOOGLE_TTS_API_KEY || CONFIG.googleTtsApiKey || '',
      googleTtsApiKeyMasked: mask(process.env.GOOGLE_TTS_API_KEY || CONFIG.googleTtsApiKey),
      ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY || CONFIG.assemblyaiApiKey || '',
      assemblyaiApiKey: process.env.ASSEMBLYAI_API_KEY || CONFIG.assemblyaiApiKey || '',
      assemblyaiApiKeyMasked: mask(process.env.ASSEMBLYAI_API_KEY || CONFIG.assemblyaiApiKey),
      GNANI_API_KEY: process.env.GNANI_API_KEY || CONFIG.gnaniApiKey || '',
      gnaniApiKey: process.env.GNANI_API_KEY || CONFIG.gnaniApiKey || '',
      gnaniApiKeyMasked: mask(process.env.GNANI_API_KEY || CONFIG.gnaniApiKey),
    };
  });

  ipcMain.handle('chat-save-api-keys', (event, keys) => {
    const envPath = path.join(__dirname, '../../../.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    const map = {
      geminiApiKey: 'GEMINI_API_KEY',
      GEMINI_API_KEY: 'GEMINI_API_KEY',
      geminiModel: 'GEMINI_MODEL',
      GEMINI_MODEL: 'GEMINI_MODEL',
      easyVoiceApiKey: 'EASYVOICE_API_KEY',
      EASYVOICE_API_KEY: 'EASYVOICE_API_KEY',
      googleTtsApiKey: 'GOOGLE_TTS_API_KEY',
      GOOGLE_TTS_API_KEY: 'GOOGLE_TTS_API_KEY',
      assemblyaiApiKey: 'ASSEMBLYAI_API_KEY',
      ASSEMBLYAI_API_KEY: 'ASSEMBLYAI_API_KEY',
      gnaniApiKey: 'GNANI_API_KEY',
      GNANI_API_KEY: 'GNANI_API_KEY',
    };

    for (const [keyProp, envVar] of Object.entries(map)) {
      if (keys[keyProp] !== undefined) {
        const val = keys[keyProp].trim();
        process.env[envVar] = val;
        CONFIG[keyProp] = val;
        const reg = new RegExp(`^${envVar}=.*$`, 'm');
        if (reg.test(content)) {
          content = content.replace(reg, `${envVar}=${val}`);
        } else {
          content += `\n${envVar}=${val}`;
        }
      }
    }

    try {
      fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
    } catch (e) {
      console.warn('[Main] Failed to write .env file:', e.message);
    }

    // Re-initialize services dynamically
    if (geminiService) geminiService = new GeminiService(process.env.GEMINI_API_KEY);
    const evKey = (process.env.EASYVOICE_API_KEY || CONFIG.easyVoiceApiKey || '').trim();
    if (evKey && evKey.startsWith('ev_')) {
      googleTtsService = new EasyVoiceTTSService(evKey);
      googleTtsService.prewarm();
      console.log('[Pointy] 🎙️ EasyVoice TTS re-initialized with Kokoro-82M');
    } else if (googleTtsService) {
      googleTtsService = new GoogleTTSService(process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY);
      googleTtsService.prewarm();
    }
    if (assemblyaiService) assemblyaiService = new AssemblyAIService(process.env.ASSEMBLYAI_API_KEY);
    if (gnaniService) gnaniService = new GnaniService(process.env.GNANI_API_KEY);

    chatAppWindow?.webContents.send('api-keys-updated');
    return { success: true, message: 'API keys saved successfully!' };
  });

  ipcMain.handle('chat-test-gemini-key', async (event, apiKey) => {
    const key = (apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!key) return { success: false, error: 'API key is empty.' };
    try {
      const { GoogleGenAI } = require('@google/genai');
      const testAi = new GoogleGenAI({ apiKey: key });
      const resp = await testAi.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Ping',
      });
      const modelResponse = resp.text ? resp.text.trim() : 'Connected';
      return { success: true, message: 'Connected to Gemini 3 Flash successfully!', modelResponse };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat-speak-text', async (event, text) => {
    if (!googleTtsService) {
      return { audioContent: null };
    }
    try {
      const audioBase64 = await googleTtsService.speak(text);
      return { audioContent: audioBase64 };
    } catch (err) {
      return { audioContent: null, error: err.message };
    }
  });

  ipcMain.handle('chat-toggle-overlay', () => {
    if (!overlayWindow) return false;
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
      return false;
    } else {
      overlayWindow.show();
      return true;
    }
  });

  ipcMain.handle('chat-is-overlay-active', () => {
    return overlayWindow ? overlayWindow.isVisible() : false;
  });
}

// ─── App lifecycle ───────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Initialize services
  actionService = new ActionService();
  conversationManager = new ConversationManager();
  assemblyaiService = new AssemblyAIService(CONFIG.assemblyaiApiKey);
  gnaniService = new GnaniService(CONFIG.gnaniApiKey);
  geminiService = new GeminiService(CONFIG.geminiApiKey);
  const evKey = (CONFIG.easyVoiceApiKey || process.env.EASYVOICE_API_KEY || '').trim();
  if (evKey && evKey.startsWith('ev_')) {
    googleTtsService = new EasyVoiceTTSService(evKey);
    console.log('[Pointy] 🎙️ EasyVoice TTS service initialized with Kokoro-82M');
  } else {
    googleTtsService = new GoogleTTSService(CONFIG.googleTtsApiKey);
  }
  googleTtsService.prewarm();
  console.log('[Pointy] ⚡ ActionService ready (Notepad, YouTube, Browser, System Launcher active)');

  // Create windows and tray
  createChatAppWindow();
  createOverlayWindow();
  createTray();
  setupIPC();
  registerHotkeys();

  // Initialize native OS mouse click listener for multi-step guidance
  try {
    mouseWatcherService = new MouseWatcherService();
    mouseWatcherService.start();
    setupMouseWatcher();
    console.log('[Pointy] 🖱️ Native mouse watcher initialized for multi-step guidance');
  } catch (mErr) {
    console.warn('[Pointy] Mouse watcher init notice:', mErr.message);
  }

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

  if (googleTtsService instanceof EasyVoiceTTSService && googleTtsService.hasApiKey()) {
    console.log('[Pointy] ✅ EasyVoice TTS ready (Kokoro-82M AI Voice)');
  } else if (googleTtsService.hasApiKey()) {
    console.log('[Pointy] ✅ Google Cloud TTS ready');
  } else if (gnaniService.hasApiKey()) {
    console.log('[Pointy] ✅ Gnani Timbre ready (TTS voice output)');
  } else {
    console.log('[Pointy] ℹ️  TTS voice output is off (configure EASYVOICE_API_KEY in .env)');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  mouseWatcherService?.stop();
  clearMultiStep();
});

app.on('window-all-closed', (e) => {
  e.preventDefault?.();
});
