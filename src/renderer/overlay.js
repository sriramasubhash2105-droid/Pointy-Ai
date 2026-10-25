/**
 * ═══════════════════════════════════════════════════════════════════════
 * POINTY AI — Spatial Red Cursor & Overlay Engine
 * Controls the Red AI Cursor pop-out, voice capture, fluid trajectory,
 * and adjacent answer speech cards.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── DOM References ──────────────────────────────────────────────────
const aiCursor = document.getElementById('ai-cursor');
const cursorShockwave = document.getElementById('cursor-shockwave');
const cursorLoadingSpinner = document.getElementById('cursor-loading-spinner');

const cursorAnswerCard = document.getElementById('cursor-answer-card');
const answerCardText = document.getElementById('answer-card-text');
const chatStream = document.getElementById('chat-stream');
const cardChatInput = document.getElementById('card-chat-input');
const cardChatMic = document.getElementById('card-chat-mic');
const cardChatSend = document.getElementById('card-chat-send');
const btnNewChat = document.getElementById('btn-new-chat');
const answerCardFooter = document.getElementById('answer-card-footer');
const answerStepInfo = document.getElementById('answer-step-info');
const answerNextBtn = document.getElementById('answer-next-btn');
const answerSkipBtn = document.getElementById('answer-skip-btn');
const answerCloseBtn = document.getElementById('answer-close-btn');
const badgeTitle = document.getElementById('badge-title');
const cardResizeHandle = document.getElementById('card-resize-handle');

let activeConversation = null;
let currentAnswerMode = 'pointer'; // 'pointer' | 'assistant'
let answerDismissTimer = null;
let standbyGlideTimer = null;

function cancelStandbyGlide() {
  if (standbyGlideTimer) {
    clearTimeout(standbyGlideTimer);
    standbyGlideTimer = null;
  }
}

// Multi-turn chat session state: true ONLY when user asked another question right after one question
let isChatModeActive = false;
let lastAnswerTurn = null; // { question, result, step }
let userHasManuallyResized = false;
let manualCardWidth = null;
let manualCardHeight = null;

const textInputContainer = document.getElementById('text-input-container');
const textInput = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');

const btnQuickVoice = document.getElementById('btn-quick-voice');
const btnQuickType = document.getElementById('btn-quick-type');

const particlesContainer = document.getElementById('particles');

// ─── State ───────────────────────────────────────────────────────────
let currentState = 'idle'; // idle | listening | thinking | pointing
let currentCursorPos = { x: window.innerWidth - 80, y: window.innerHeight - 80 };
let isFollowingMouse = false;
let currentSteps = [];
let currentStepIndex = 0;
let displayInfo = null;

// Smooth, fluid companion flow state
let targetCursorPos = { x: -100, y: -100 };
let currentRenderPos = { x: -100, y: -100 };
let currentTilt = 0;
let isLerpLoopRunning = false;

let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];
let speechRecognizer = null;
let finalTranscript = '';
let speechSilenceTimer = null;
let activeAudio = null;
let vadAudioContext = null;
let vadAnalyser = null;
let vadInterval = null;

// ─── Initialize ──────────────────────────────────────────────────────
async function init() {
  setupEventListeners();
  setupIPCListeners();
  setupSpeechRecognition();
  setupCardResize();

  // Start directly in companion following mode at mouse cursor
  currentState = 'idle';
  isFollowingMouse = true;
  aiCursor.classList.add('idle', 'following');
  aiCursor.classList.remove('flying', 'listening', 'thinking', 'pointing');
  cursorAnswerCard.classList.add('hidden');
  cursorLoadingSpinner?.classList.add('hidden');
  hideTextInput();

  // Attach immediately to current mouse position
  window.pointyAPI.getCursorPosition().then((pos) => {
    if (pos && typeof pos.x === 'number') {
      followOriginalCursor(pos.x, pos.y);
    }
  }).catch(() => {});

  try {
    displayInfo = await window.pointyAPI.getDisplayInfo();
  } catch (e) {
    displayInfo = { size: { width: window.innerWidth, height: window.innerHeight } };
  }

  // Load existing conversation memory reference in background
  try {
    if (window.pointyAPI.getActiveConversation) {
      activeConversation = await window.pointyAPI.getActiveConversation();
    }
  } catch (e) {
    console.warn('[Overlay] Notice loading active conversation:', e);
  }

  console.log('[Pointy Spatial Cursor] Engine ready - following cursor companion');
}

// ─── Setup IPC Listeners ─────────────────────────────────────────────
function setupIPCListeners() {
  // Pop out cursor directly from the user's mouse position!
  window.pointyAPI.onPopOutCursor((pos) => {
    console.log('[Overlay] Pop-out cursor requested at:', pos);
    popOutCursor(pos.x, pos.y);
  });

  // Startup intro animation so the user sees Pointy immediately
  window.pointyAPI.onStartupIntro((pos) => {
    console.log('[Overlay] Startup intro showcase at:', pos);
    playStartupIntro(pos);
  });

  // Follow original cursor continuously while summoned & not pointing at solution
  window.pointyAPI.onCursorFollow((pos) => {
    followOriginalCursor(pos.x, pos.y);
  });

  // Toggle text input from global hotkey (Alt+T) or tray
  window.pointyAPI.onToggleTextInput(() => {
    toggleTextInput();
  });

  window.pointyAPI.onStateChange((state) => {
    setAppState(state);
  });

  window.pointyAPI.onStartRecording(() => {
    startVoiceSession();
  });

  window.pointyAPI.onStopRecording(() => {
    stopVoiceSession();
  });

  window.pointyAPI.onTranscript((data) => {
    // Keep viewer's screen completely unobstructed
  });

  window.pointyAPI.onPointAt((data) => {
    handlePointAt(data.result, data.audioBase64, data.conversation, data.question);
  });

  window.pointyAPI.onConversationUpdated?.((data) => {
    if (data && data.conversation) {
      activeConversation = data.conversation;
      renderConversation(activeConversation, data.latestResult);
    }
  });

  window.pointyAPI.onPlayAudio((audioBase64) => {
    playAudioBase64(audioBase64);
  });

  window.pointyAPI.onError((message) => {
    aiCursor.classList.remove('thinking');
    cursorLoadingSpinner?.classList.add('hidden');
    removeThinkingTurn();
    showAnswerBesideCursor(`⚠️ ${message}`, null);
    setTimeout(() => {
      resetToStandby();
    }, 4500);
  });

  window.pointyAPI.onReset(() => {
    resetToStandby();
  });
}

// ─── Setup Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
  // CRITICAL: Window click-through hit testing
  // Only change click-through when transitioning between interactive and non-interactive regions
  let isMouseHoveringInteractive = false;
  window.addEventListener('mousemove', (event) => {
    const isInteractive = !!event.target.closest(
      '#cursor-answer-card, #text-input-container, button, input, .chat-turn, .code-copy-btn, .card-resize-handle'
    );
    if (isInteractive !== isMouseHoveringInteractive) {
      isMouseHoveringInteractive = isInteractive;
      if (isInteractive) {
        window.pointyAPI.setIgnoreMouseEvents(false);
      } else {
        window.pointyAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  });

  // Clicking the Red AI Cursor when idle summons it to pop out!
  aiCursor.addEventListener('click', (e) => {
    if (currentState === 'idle') {
      console.log('[Overlay] Red Cursor clicked -> summoning to mouse position');
      window.pointyAPI.triggerVoiceSummon();
    }
  });

  // Double-clicking or right-clicking the Red Cursor toggles text input
  aiCursor.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    toggleTextInput();
  });

  aiCursor.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTextInput();
  });

  // Quick Action hover menu buttons
  btnQuickVoice?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.pointyAPI.triggerVoiceSummon();
  });

  btnQuickType?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTextInput();
  });

  // Answer card controls
  answerCloseBtn.addEventListener('click', () => {
    resetToStandby();
  });

  answerNextBtn.addEventListener('click', () => {
    goToNextStep();
  });

  answerSkipBtn.addEventListener('click', () => {
    resetToStandby();
  });

  // Start New Chat session button (resets multi-turn chat to fresh state)
  btnNewChat?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      if (window.pointyAPI.startNewChat) {
        const newConv = await window.pointyAPI.startNewChat();
        activeConversation = newConv;
      }
    } catch (err) {
      console.warn('[Overlay] startNewChat error:', err);
    }
    isChatModeActive = false;
    lastAnswerTurn = null;
    userHasManuallyResized = false;
    manualCardWidth = null;
    manualCardHeight = null;
    resetToStandby();
  });

  // Follow-up card input bar: typing & send
  cardChatSend?.addEventListener('click', (e) => {
    e.stopPropagation();
    submitFollowUpQuestion();
  });

  cardChatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      submitFollowUpQuestion();
    }
  });

  // Follow-up card input bar: voice mic
  cardChatMic?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleFollowUpMicClick();
  });

  // Keep answer card open while reading or interacting
  cursorAnswerCard?.addEventListener('mouseenter', () => {
    if (answerDismissTimer) {
      clearTimeout(answerDismissTimer);
      answerDismissTimer = null;
    }
  });

  cardChatInput?.addEventListener('focus', () => {
    if (answerDismissTimer) {
      clearTimeout(answerDismissTimer);
      answerDismissTimer = null;
    }
  });

  // Text input fallback
  textSubmit.addEventListener('click', submitTypedQuestion);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTypedQuestion();
    if (e.key === 'Escape') hideTextInput();
  });

  // Global key navigation (Escape key returns to right bottom side of window)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.pointyAPI.requestReset();
      resetToStandby();
    }
  });
}

// ─── Red Cursor Pop-Out Logic (From User's Mouse Position) ───────────
function popOutCursor(x, y) {
  cancelStandbyGlide();
  const clampX = Math.max(0, Math.min(x || window.innerWidth / 2, window.innerWidth - 10));
  const clampY = Math.max(0, Math.min(y || window.innerHeight / 2, window.innerHeight - 10));

  isFollowingMouse = true;
  aiCursor.classList.remove('flying');
  aiCursor.classList.add('following');
  aiCursor.style.bottom = 'auto';
  aiCursor.style.right = 'auto';

  // Smooth companion offset (+14px, +12px) so user's original cursor pointer is 100% visible
  const targetX = clampX + 14;
  const targetY = clampY + 12;
  aiCursor.style.left = (targetX - 3.6) + 'px';
  aiCursor.style.top = (targetY - 0.5) + 'px';
  currentCursorPos = { x: targetX, y: targetY };

  // Trigger pop-out scale animation
  aiCursor.classList.remove('pop-out');
  void aiCursor.offsetWidth;
  aiCursor.classList.add('pop-out');

  // Trigger red shockwave ripple animation
  cursorShockwave.classList.remove('animate');
  void cursorShockwave.offsetWidth;
  cursorShockwave.classList.add('animate');

  // Spawn subtle red laser burst particles from user's mouse coordinates
  spawnParticles(clampX, clampY, 12);

  // NO text window shown while listening — viewer needs full screen visibility!
  cursorAnswerCard.classList.add('hidden');
  setAppState('listening');
}

// ─── Real-time Cursor Following (Tracks user's original cursor) ───────
function followOriginalCursor(mouseX, mouseY) {
  if (currentState === 'pointing') {
    return;
  }
  isFollowingMouse = true;

  // Smooth companion offset (+16px right, +14px down)
  // Keeps the original OS mouse cursor unobstructed and visible
  const offsetX = 16;
  const offsetY = 14;

  let targetX = mouseX + offsetX;
  let targetY = mouseY + offsetY;

  // Screen boundary guards: allow smooth movement over edges and taskbar
  if (targetX + 28 > window.innerWidth) {
    targetX = mouseX - 28;
  }
  if (targetY + 28 > window.innerHeight) {
    targetY = mouseY - 28;
  }

  targetX = Math.max(0, Math.min(targetX, window.innerWidth - 4));
  targetY = Math.max(0, Math.min(targetY, window.innerHeight - 4));

  targetCursorPos.x = targetX;
  targetCursorPos.y = targetY;

  // If first position, snap instantly so it doesn't fly from off-screen
  if (currentRenderPos.x < 0) {
    currentRenderPos.x = targetX;
    currentRenderPos.y = targetY;
    aiCursor.style.left = (targetX - 3.6) + 'px';
    aiCursor.style.top = (targetY - 0.5) + 'px';
  }

  if (!isLerpLoopRunning) {
    startLerpLoop();
  }
}

function startLerpLoop() {
  isLerpLoopRunning = true;

  function loop() {
    if (currentState !== 'pointing' && !aiCursor.classList.contains('flying')) {
      const dx = targetCursorPos.x - currentRenderPos.x;
      const dy = targetCursorPos.y - currentRenderPos.y;

      // Responsive, fluid drag damping factor (snappy yet buttery smooth)
      const ease = 0.20;

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        currentRenderPos.x += dx * ease;
        currentRenderPos.y += dy * ease;

        // Gentle, subtle aerodynamic tilt (-5deg to +5deg)
        const targetTilt = Math.max(-5, Math.min(5, dx * 0.12));
        currentTilt += (targetTilt - currentTilt) * 0.18;

        aiCursor.style.left = (currentRenderPos.x - 3.6) + 'px';
        aiCursor.style.top = (currentRenderPos.y - 0.5) + 'px';
        aiCursor.style.transform = `rotate(${currentTilt.toFixed(2)}deg)`;
        currentCursorPos = { x: currentRenderPos.x, y: currentRenderPos.y };
      } else {
        if (Math.abs(currentTilt) > 0.02) {
          currentTilt += (0 - currentTilt) * 0.18;
          aiCursor.style.transform = `rotate(${currentTilt.toFixed(2)}deg)`;
        }
      }
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// ─── Startup Intro Showcase ──────────────────────────────────────────
function playStartupIntro(mousePos) {
  const x = (mousePos && typeof mousePos.x === 'number') ? mousePos.x : window.innerWidth / 2;
  const y = (mousePos && typeof mousePos.y === 'number') ? mousePos.y : window.innerHeight / 2;

  isFollowingMouse = true;
  followOriginalCursor(x, y);

  aiCursor.classList.remove('pop-out');
  void aiCursor.offsetWidth;
  aiCursor.classList.add('pop-out');

  cursorShockwave.classList.remove('animate');
  void cursorShockwave.offsetWidth;
  cursorShockwave.classList.add('animate');

  spawnParticles(x + 14, y + 12, 12);
  cursorAnswerCard.classList.add('hidden');
}

// ─── State Management ────────────────────────────────────────────────
function setAppState(state) {
  if (state !== 'idle') {
    cancelStandbyGlide();
  }
  currentState = state;
  aiCursor.classList.remove('listening', 'thinking', 'pointing');
  if (state !== 'idle') {
    aiCursor.classList.remove('idle');
    aiCursor.classList.add(state);
  }

  // When state is 'thinking': red cursor graphic is replaced by the loading spinner
  if (state === 'thinking') {
    cursorLoadingSpinner?.classList.remove('hidden');
  } else {
    cursorLoadingSpinner?.classList.add('hidden');
  }
}

// ─── Voice Capture & Recognition ─────────────────────────────────────
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  try {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = false;
    speechRecognizer.interimResults = true;
    speechRecognizer.lang = 'en-US';

    speechRecognizer.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Keep screen completely clear while user is speaking (no text window)

      // Auto-silence timer
      if (speechSilenceTimer) clearTimeout(speechSilenceTimer);
      speechSilenceTimer = setTimeout(() => {
        stopVoiceSession();
      }, 1600);
    };

    speechRecognizer.onerror = (e) => {
      console.warn('[Pointy] Web Speech notice:', e.error);
    };

    speechRecognizer.onend = () => {
      if (currentState === 'listening' && finalTranscript) {
        submitVoiceQuestion(finalTranscript);
      }
    };
  } catch (err) {
    console.warn('[Pointy] SpeechRecognition init:', err);
  }
}

async function startVoiceSession() {
  finalTranscript = '';
  audioChunks = [];

  // Start speech recognition if available
  if (speechRecognizer) {
    try {
      speechRecognizer.start();
    } catch (_) {}
  }

  // Also record audio chunks via MediaRecorder as audio pipeline
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm;codecs=opus' });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      // If text transcription already submitted, skip sending raw audio
      if (finalTranscript) return;

      if (audioChunks.length === 0) return;
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      window.pointyAPI.sendAudio(base64);
    };

    mediaRecorder.start(100);

    // Local Web Audio API VAD (Voice Activity Detection)
    // Runs on device — automatically detects speech start and silence end
    try {
      vadAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = vadAudioContext.createMediaStreamSource(mediaStream);
      vadAnalyser = vadAudioContext.createAnalyser();
      vadAnalyser.fftSize = 512;
      source.connect(vadAnalyser);

      const dataArray = new Uint8Array(vadAnalyser.frequencyBinCount);
      let speechDetected = false;
      let silenceStartTime = 0;
      const sessionStart = Date.now();

      vadInterval = setInterval(() => {
        if (!vadAnalyser || currentState !== 'listening') return;

        vadAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;

        // Threshold: voice speech usually produces avg > 11
        if (avg > 11) {
          if (!speechDetected) {
            console.log('[Pointy VAD] 🎙️ Speech detected (vol:', Math.round(avg), ')');
            speechDetected = true;
          }
          silenceStartTime = 0;
        } else if (speechDetected) {
          if (!silenceStartTime) {
            silenceStartTime = Date.now();
          } else if (Date.now() - silenceStartTime > 1300) {
            console.log('[Pointy VAD] ⏹️ 1.3s silence after speech. Auto-submitting...');
            stopVoiceSession();
          }
        } else if (Date.now() - sessionStart > 7500) {
          console.log('[Pointy VAD] ⏹️ 7.5s elapsed without speech. Submitting...');
          stopVoiceSession();
        }
      }, 50);
    } catch (vadErr) {
      console.warn('[Pointy VAD] Notice initializing Web Audio VAD:', vadErr);
    }
  } catch (err) {
    console.warn('[Pointy] MediaRecorder fallback notice:', err);
  }
}

function stopVoiceSession() {
  if (speechSilenceTimer) clearTimeout(speechSilenceTimer);

  if (vadInterval) {
    clearInterval(vadInterval);
    vadInterval = null;
  }
  if (vadAudioContext && vadAudioContext.state !== 'closed') {
    vadAudioContext.close().catch(() => {});
    vadAudioContext = null;
    vadAnalyser = null;
  }

  if (speechRecognizer) {
    try {
      speechRecognizer.stop();
    } catch (_) {}
  }

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }

  if (finalTranscript) {
    submitVoiceQuestion(finalTranscript);
  } else {
    setAppState('thinking');
  }
}

function submitVoiceQuestion(text) {
  setAppState('thinking');

  // If the answer card was open when the user asked this question, it becomes a chat!
  const cardIsOpen = cursorAnswerCard && !cursorAnswerCard.classList.contains('hidden');
  if (isChatModeActive || (cardIsOpen && lastAnswerTurn)) {
    if (!isChatModeActive && lastAnswerTurn) {
      isChatModeActive = true;
      cursorAnswerCard.classList.add('chat-mode');
      applyCardSizing('', true);
      chatStream.innerHTML = '';
      if (lastAnswerTurn.question) {
        appendUserTurn(lastAnswerTurn.question);
      }
      if (lastAnswerTurn.result) {
        const prevAst = createAssistantTurnElement(lastAnswerTurn.result);
        chatStream.appendChild(prevAst);
        attachStreamListeners();
      }
    }
    appendUserTurn(text);
    appendThinkingTurn();
  }

  window.pointyAPI.sendTypedQuestion(text);
}

// ─── Lightweight Markdown Renderer (For Assistant Explanations) ─────
function renderMarkdownToHtml(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks: ```lang\ncode\n```
  html = html.replace(/```(?:[a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (match, code) => {
    const raw = code.trim();
    return `<div class="code-block-wrapper"><button class="code-copy-btn" type="button">Copy</button><pre><code>${raw}</code></pre></div>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings: ### Header or ## Header or # Header
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h3>$1</h3>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Bullet items: - item or * item
  html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n|$)(\s*))+/g, '<ul>$&</ul>');

  // Numbered list items: 1. item
  html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<li>$1</li>');

  // Paragraphs (split by double newlines)
  const parts = html.split(/\n{2,}/);
  html = parts.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<div class="code-block-wrapper"') || p.startsWith('<pre') || p.startsWith('<ul>') || p.startsWith('<ol>')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Single Answer & Multi-Turn Chat Engine ───────────────────────────

let activeStreamingTimer = null;

/**
 * Creates an assistant turn DOM node:
 * - Shows ONLY what Pointy speaks initially with real-time text expansion
 * - Provides a "View Full Details" toggle to reveal full markdown, code, and steps
 */
function createAssistantTurnElement(result, shouldStream = false) {
  const astDiv = document.createElement('div');
  astDiv.className = 'chat-turn assistant';

  const spoken = (result.reply || (result.detailed_explanation ? result.detailed_explanation.split('\n')[0] : '')).trim();
  const detailed = (result.detailed_explanation || spoken).trim();
  const hasExtraDetails = !!(
    detailed &&
    ((detailed !== spoken && detailed.length > spoken.length + 5) ||
     detailed.includes('```') ||
     detailed.includes('###') ||
     detailed.includes('- ') ||
     detailed.includes('\n') ||
     (result.steps && result.steps.length > 0))
  );

  let inner = `
    <div class="spoken-speech-wrapper">
      <div class="spoken-speech-header">
        <span class="speech-avatar-dot"></span>
        <span class="speech-tag">Pointy Spoken</span>
      </div>
      <div class="spoken-speech-bubble">
        <span class="spoken-text-content">${escapeHtml(spoken)}</span>
        <span class="speech-typing-cursor hidden"></span>
      </div>
    </div>
  `;

  if (hasExtraDetails) {
    inner += `
      <div class="details-toggle-wrapper">
        <button class="btn-toggle-details" type="button" title="Click to view full explanation, code, and details">
          <span class="toggle-icon">✨</span>
          <span class="toggle-text">View Full Details</span>
          <span class="toggle-arrow">▾</span>
        </button>
      </div>

      <div class="detailed-expansion-container collapsed">
        <div class="detailed-expansion-inner">
          <div class="chat-msg-text">${renderMarkdownToHtml(detailed)}</div>
  `;

    if (result.steps && result.steps.length > 0) {
      const step = result.steps[0];
      const label = step.label || step.instruction || 'Target Location';
      inner += `<div class="chat-target-badge" title="Point at this target again"><span>📍</span><span>Pointed to: ${escapeHtml(label)}</span></div>`;
    }

    inner += `
        </div>
      </div>
    `;
  } else if (result.steps && result.steps.length > 0) {
    const step = result.steps[0];
    const label = step.label || step.instruction || 'Target Location';
    inner += `<div class="chat-target-badge" title="Point at this target again"><span>📍</span><span>Pointed to: ${escapeHtml(label)}</span></div>`;
  }

  astDiv.innerHTML = inner;

  // Setup streaming animation if requested
  const textSpan = astDiv.querySelector('.spoken-text-content');
  const cursorSpan = astDiv.querySelector('.speech-typing-cursor');

  if (shouldStream && spoken && textSpan) {
    streamSpokenText(spoken, textSpan, cursorSpan, astDiv);
  }

  // Setup View Full Details toggle
  const toggleBtn = astDiv.querySelector('.btn-toggle-details');
  const detailsContainer = astDiv.querySelector('.detailed-expansion-container');

  if (toggleBtn && detailsContainer) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (answerDismissTimer) {
        clearTimeout(answerDismissTimer);
        answerDismissTimer = null;
      }

      const isCurrentlyCollapsed = detailsContainer.classList.contains('collapsed');
      if (isCurrentlyCollapsed) {
        detailsContainer.classList.remove('collapsed');
        detailsContainer.classList.add('expanded');
        toggleBtn.classList.add('expanded');
        toggleBtn.classList.remove('ready-pulse');
        toggleBtn.querySelector('.toggle-text').textContent = 'Hide Details';
        toggleBtn.querySelector('.toggle-arrow').textContent = '▴';
        cursorAnswerCard.classList.add('details-open');
        applyCardSizing(detailed, isChatModeActive, true);
      } else {
        detailsContainer.classList.add('collapsed');
        detailsContainer.classList.remove('expanded');
        toggleBtn.classList.remove('expanded');
        toggleBtn.querySelector('.toggle-text').textContent = 'View Full Details';
        toggleBtn.querySelector('.toggle-arrow').textContent = '▾';
        cursorAnswerCard.classList.remove('details-open');
        applyCardSizing(spoken, isChatModeActive, false);
      }
      setTimeout(() => repositionAnswerCard(), 60);
    });
  }

  return astDiv;
}

let activeTypingTimer = null;

function positionBubbleAtCursor(cursorX, cursorY) {
  const wrapper = document.getElementById('cursor-answer-card');
  const bubble = document.getElementById('speech-bubble');
  if (!wrapper) return;

  const x = (typeof cursorX === 'number') ? cursorX : (currentCursorPos ? currentCursorPos.x : window.innerWidth / 2);
  const y = (typeof cursorY === 'number') ? cursorY : (currentCursorPos ? currentCursorPos.y : window.innerHeight / 2);

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const bubbleH = bubble && bubble.offsetHeight ? bubble.offsetHeight : 44;

  // Decide horizontal orientation based on screen room
  const shouldFlipLeft = (x > screenW - 320) || (x + 280 > screenW - 20);

  if (shouldFlipLeft) {
    wrapper.classList.add('flipped-left');
    // Pin right edge 16px to the left of Pointy
    const rightPos = Math.max(16, (screenW - x) + 16);
    wrapper.style.right = `${Math.round(rightPos)}px`;
    wrapper.style.left = 'auto';
  } else {
    wrapper.classList.remove('flipped-left');
    // Pin left edge 28px to the right of Pointy
    const leftPos = Math.max(16, x + 28);
    wrapper.style.left = `${Math.round(leftPos)}px`;
    wrapper.style.right = 'auto';
  }

  // Vertical positioning: align bubble top slightly elevated relative to Pointy tip
  let topPos = y - 12;
  if (topPos + bubbleH > screenH - 20) {
    topPos = Math.max(16, screenH - bubbleH - 20);
  }
  if (topPos < 16) {
    topPos = 16;
  }

  wrapper.style.top = `${Math.round(topPos)}px`;
  wrapper.style.transform = 'none';
}

function setupBubbleDetailsToggle() {
  const toggleBtn = document.getElementById('bubble-details-toggle');
  const detailsBody = document.getElementById('bubble-details-body');
  if (!toggleBtn || !detailsBody) return;

  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    if (answerDismissTimer) {
      clearTimeout(answerDismissTimer);
      answerDismissTimer = null;
    }
    const isCollapsed = detailsBody.classList.contains('collapsed');
    if (isCollapsed) {
      detailsBody.classList.remove('collapsed');
      toggleBtn.textContent = 'hide details ▴';
    } else {
      detailsBody.classList.add('collapsed');
      toggleBtn.textContent = 'view full details ▾';
    }
    setTimeout(() => positionBubbleAtCursor(), 40);
  };
}

function setupBubbleChatActions() {
  const actions = document.getElementById('bubble-actions');
  const btnContinue = document.getElementById('bubble-btn-continue');
  const btnNew = document.getElementById('bubble-btn-new');
  const replyBar = document.getElementById('bubble-reply-bar');
  const replyInput = document.getElementById('bubble-reply-input');
  const replyMic = document.getElementById('bubble-reply-mic');
  const replySend = document.getElementById('bubble-reply-send');

  if (!btnContinue || !btnNew || !replyBar || !replyInput) return;

  btnContinue.onclick = (e) => {
    e.stopPropagation();
    if (answerDismissTimer) {
      clearTimeout(answerDismissTimer);
      answerDismissTimer = null;
    }
    btnContinue.classList.add('active');
    btnNew.classList.remove('active');

    replyBar.classList.remove('hidden');
    replyInput.placeholder = 'Ask a follow-up...';
    window.pointyAPI.setIgnoreMouseEvents(false);
    setTimeout(() => {
      replyInput.focus();
      positionBubbleAtCursor();
    }, 40);
  };

  btnNew.onclick = async (e) => {
    e.stopPropagation();
    if (answerDismissTimer) {
      clearTimeout(answerDismissTimer);
      answerDismissTimer = null;
    }
    btnNew.classList.add('active');
    btnContinue.classList.remove('active');

    try {
      if (window.pointyAPI.startNewChat) {
        activeConversation = await window.pointyAPI.startNewChat();
      }
    } catch (err) {
      console.warn('[Overlay] startNewChat error:', err);
    }
    lastAnswerTurn = null;
    isChatModeActive = false;

    replyBar.classList.remove('hidden');
    replyInput.placeholder = '✨ Start a new conversation...';
    window.pointyAPI.setIgnoreMouseEvents(false);
    setTimeout(() => {
      replyInput.focus();
      positionBubbleAtCursor();
    }, 40);
  };

  const submitBubbleReply = () => {
    const question = replyInput.value.trim();
    if (!question) return;

    if (answerDismissTimer) {
      clearTimeout(answerDismissTimer);
      answerDismissTimer = null;
    }

    replyInput.value = '';
    replyBar.classList.add('hidden');
    actions?.classList.add('hidden');

    setAppState('thinking');
    window.pointyAPI.sendTypedQuestion(question);
  };

  if (replySend) {
    replySend.onclick = (e) => {
      e.stopPropagation();
      submitBubbleReply();
    };
  }

  replyInput.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      submitBubbleReply();
    } else if (e.key === 'Escape') {
      replyBar.classList.add('hidden');
      btnContinue.classList.remove('active');
      btnNew.classList.remove('active');
      positionBubbleAtCursor();
    }
  };

  replyInput.onfocus = () => {
    if (answerDismissTimer) {
      clearTimeout(answerDismissTimer);
      answerDismissTimer = null;
    }
  };

  if (replyMic) {
    replyMic.onclick = (e) => {
      e.stopPropagation();
      if (answerDismissTimer) {
        clearTimeout(answerDismissTimer);
        answerDismissTimer = null;
      }
      handleFollowUpMicClick();
    };
  }
}

/**
 * Renders the minimalist Pointy-red outgoing chat speech bubble:
 * Anchored directly beside where the Pointy cursor goes or points to!
 * Starts with a tiny pill-like bubble containing just the first character,
 * and progressively reveals text character-by-character while expanding smoothly
 * in width and height, complete with seamless bottom-right tail, muted blue border,
 * vibrant red gradient, and blinking white cursor.
 */
function typeOutSpeechBubble(fullText, detailedExplanation = '', hasExtra = false, showChatActions = false) {
  if (activeTypingTimer) {
    clearInterval(activeTypingTimer);
    activeTypingTimer = null;
  }
  if (answerDismissTimer) {
    clearTimeout(answerDismissTimer);
    answerDismissTimer = null;
  }

  const bubbleText = document.getElementById('bubble-text');
  const bubbleCursor = document.getElementById('bubble-cursor');
  const detailsContainer = document.getElementById('bubble-details-container');
  const detailsBody = document.getElementById('bubble-details-body');
  const detailsToggle = document.getElementById('bubble-details-toggle');
  const bubbleActions = document.getElementById('bubble-actions');
  const bubbleReplyBar = document.getElementById('bubble-reply-bar');
  const bubbleReplyInput = document.getElementById('bubble-reply-input');
  const speechBubble = document.getElementById('speech-bubble');

  if (!bubbleText || !cursorAnswerCard) return;

  // Reveal speech bubble container anchored to Pointy's position!
  positionBubbleAtCursor();
  cursorAnswerCard.classList.remove('hidden');

  // Reset details view and actions
  if (detailsContainer) {
    detailsContainer.classList.add('hidden');
  }
  if (detailsBody) {
    detailsBody.classList.add('collapsed');
    detailsBody.innerHTML = '';
  }
  if (detailsToggle) {
    detailsToggle.textContent = 'view full details ▾';
  }
  if (bubbleActions) {
    bubbleActions.classList.add('hidden');
  }
  if (bubbleReplyBar) {
    bubbleReplyBar.classList.add('hidden');
  }
  if (bubbleReplyInput) {
    bubbleReplyInput.value = '';
  }

  const text = (fullText || '').trim();
  if (!text) return;

  // Start with tiny speech bubble containing just the first character
  let charIdx = 1;
  bubbleText.textContent = text.slice(0, 1);
  if (bubbleCursor) bubbleCursor.classList.remove('hidden');
  positionBubbleAtCursor();

  // Character typing cadence: ~26ms per character for continuous, natural typing
  const charDelay = 26;

  activeTypingTimer = setInterval(() => {
    if (charIdx < text.length) {
      charIdx++;
      bubbleText.textContent = text.slice(0, charIdx);
      if (charIdx % 4 === 0 || charIdx === text.length) {
        positionBubbleAtCursor();
      }
    } else {
      clearInterval(activeTypingTimer);
      activeTypingTimer = null;
      if (bubbleCursor) bubbleCursor.classList.add('hidden');
      positionBubbleAtCursor();

      // Finished typing: reveal minimalist "view full details" if extra info exists
      if (hasExtra && detailedExplanation && detailsContainer && detailsBody) {
        detailsBody.innerHTML = renderMarkdownToHtml(detailedExplanation);
        detailsContainer.classList.remove('hidden');
        setupBubbleDetailsToggle();
      }

      // Reveal chat actions only if allowed (never for pointing queries)
      if (showChatActions && bubbleActions) {
        bubbleActions.classList.remove('hidden');
        setupBubbleChatActions();
      } else if (bubbleActions) {
        bubbleActions.classList.add('hidden');
      }
      positionBubbleAtCursor();

      // Briefly hold the finished bubble on screen (8.5 seconds)
      if (answerDismissTimer) clearTimeout(answerDismissTimer);
      answerDismissTimer = setTimeout(() => {
        resetToStandby();
      }, 8500);
    }
  }, charDelay);

  // If user clicks anywhere on speech bubble while typing, complete instantly
  const finishInstantly = () => {
    if (activeTypingTimer) {
      clearInterval(activeTypingTimer);
      activeTypingTimer = null;
      if (bubbleCursor) bubbleCursor.classList.add('hidden');
      bubbleText.textContent = text;
      positionBubbleAtCursor();

      if (hasExtra && detailedExplanation && detailsContainer && detailsBody) {
        detailsBody.innerHTML = renderMarkdownToHtml(detailedExplanation);
        detailsContainer.classList.remove('hidden');
        setupBubbleDetailsToggle();
      }

      if (showChatActions && bubbleActions) {
        bubbleActions.classList.remove('hidden');
        setupBubbleChatActions();
      } else if (bubbleActions) {
        bubbleActions.classList.add('hidden');
      }
      positionBubbleAtCursor();

      if (answerDismissTimer) clearTimeout(answerDismissTimer);
      answerDismissTimer = setTimeout(() => {
        resetToStandby();
      }, 8500);
    }
  };

  if (speechBubble) {
    speechBubble.onclick = (e) => {
      if (e.target && e.target.closest('#bubble-details-toggle, #bubble-actions, #bubble-reply-bar')) return;
      finishInstantly();
    };
  }
}

/**
 * Streams the spoken text (chat-mode turn fallback)
 */
function streamSpokenText(fullText, textElement, cursorElement, astDiv) {
  if (activeStreamingTimer) {
    clearInterval(activeStreamingTimer);
    activeStreamingTimer = null;
  }

  const words = fullText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return;

  textElement.textContent = '';
  cursorElement?.classList.remove('hidden');

  let currentWordIdx = 0;
  const delay = 100;

  activeStreamingTimer = setInterval(() => {
    if (currentWordIdx < words.length) {
      const word = words[currentWordIdx];
      const wordSpan = document.createElement('span');
      wordSpan.className = 'stream-word';
      wordSpan.textContent = (currentWordIdx === 0 ? '' : ' ') + word;
      textElement.appendChild(wordSpan);
      currentWordIdx++;
    } else {
      clearInterval(activeStreamingTimer);
      activeStreamingTimer = null;
      cursorElement?.classList.add('hidden');
    }
  }, delay);

  const finishImmediately = () => {
    if (activeStreamingTimer) {
      clearInterval(activeStreamingTimer);
      activeStreamingTimer = null;
      textElement.textContent = fullText;
      cursorElement?.classList.add('hidden');
    }
  };

  astDiv.addEventListener('click', finishImmediately, { once: true });
}

/**
 * Attaches copy button and target badge click listeners inside chat stream
 */
function attachStreamListeners() {
  if (!chatStream) return;
  chatStream.querySelectorAll('.code-copy-btn').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const codeBlock = btn.nextElementSibling?.querySelector('code') || btn.parentElement?.querySelector('code');
      if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.innerText).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      }
    };
  });

  chatStream.querySelectorAll('.chat-target-badge').forEach((badge) => {
    badge.onclick = (e) => {
      e.stopPropagation();
      if (currentSteps && currentSteps.length > 0) {
        pointToStep(0, null, null, isChatModeActive);
      }
    };
  });
}

/**
 * Applies dynamic sizing tiers according to the answer's demand:
 * - size-compact: short 1-line or 2-line answers (~310px width)
 * - size-medium: 2-4 sentences (~410px width)
 * - size-expanded: full details, code blocks, or expanded mode (~520px width)
 */
function applyCardSizing(content = '', isChat = false, isExpanded = false) {
  if (userHasManuallyResized && manualCardWidth && manualCardHeight) {
    cursorAnswerCard.classList.add('manually-resized');
    cursorAnswerCard.style.width = `${manualCardWidth}px`;
    cursorAnswerCard.style.height = `${manualCardHeight}px`;
    return;
  }

  cursorAnswerCard.classList.remove('size-compact', 'size-medium', 'size-expanded', 'chat-mode', 'manually-resized');
  cursorAnswerCard.style.width = '';
  cursorAnswerCard.style.height = '';

  if (isChat || isExpanded) {
    cursorAnswerCard.classList.add('size-expanded');
    if (isChat) cursorAnswerCard.classList.add('chat-mode');
    return;
  }

  const text = content || '';
  const textLength = text.length;

  if (textLength > 120) {
    cursorAnswerCard.classList.add('size-medium');
  } else {
    cursorAnswerCard.classList.add('size-compact');
  }
}

/**
 * Setup interactive drag resizing for the answer card corner
 */
function setupCardResize() {
  if (!cardResizeHandle || !cursorAnswerCard) return;

  let startX = 0, startY = 0, startW = 0, startH = 0;
  let isResizing = false;

  function onMouseMove(e) {
    if (!isResizing) return;
    const isFlipped = cursorAnswerCard.classList.contains('flipped-left');
    const deltaX = isFlipped ? (startX - e.clientX) : (e.clientX - startX);
    const deltaY = e.clientY - startY;

    const newW = Math.max(260, Math.min(window.innerWidth - 60, startW + deltaX));
    const newH = Math.max(120, Math.min(window.innerHeight - 60, startH + deltaY));

    userHasManuallyResized = true;
    manualCardWidth = newW;
    manualCardHeight = newH;

    cursorAnswerCard.classList.add('manually-resized');
    cursorAnswerCard.style.width = `${newW}px`;
    cursorAnswerCard.style.height = `${newH}px`;
  }

  function onMouseUp() {
    if (!isResizing) return;
    isResizing = false;
    cardResizeHandle.classList.remove('resizing');
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  cardResizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    cardResizeHandle.classList.add('resizing');
    startX = e.clientX;
    startY = e.clientY;
    startW = cursorAnswerCard.offsetWidth;
    startH = cursorAnswerCard.offsetHeight;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

/**
 * Renders the minimalist light-red outgoing chat speech bubble:
 * Starts with a tiny pill-like bubble containing just the first character,
 * and progressively reveals text character-by-character while expanding smoothly
 * in width and height, complete with seamless bottom-right tail, muted blue border,
 * subtle red gradient, and blinking cursor.
 */
function renderSingleAnswer(result, question) {
  removeThinkingTurn();

  // When pointing things out, do NOT show continue chat or new chat — just show the text!
  const isPointing = (result.mode === 'pointer') || (Array.isArray(result.steps) && result.steps.length > 0);

  const spoken = (result.reply || (result.detailed_explanation ? result.detailed_explanation.split('\n')[0] : '')).trim();
  const detailed = (result.detailed_explanation || spoken).trim();
  const hasExtra = !isPointing && !!(
    detailed &&
    ((detailed !== spoken && detailed.length > spoken.length + 5) ||
     detailed.includes('```') ||
     detailed.includes('###') ||
     detailed.includes('- ') ||
     detailed.includes('\n'))
  );

  const showChatActions = !isPointing;
  typeOutSpeechBubble(spoken, detailed, hasExtra, showChatActions);
}

/**
 * Optional full conversation renderer (if requested)
 */
function renderConversation(conv) {
  if (!chatStream) return;
  removeThinkingTurn();

  if (!conv || !conv.messages || conv.messages.length === 0) {
    chatStream.innerHTML = `
      <div class="chat-turn assistant">
        <div class="chat-msg-text">
          <p>✨ <strong>Hi! I am Pointy AI</strong>, your desktop companion.</p>
        </div>
      </div>
    `;
    return;
  }

  chatStream.innerHTML = '';
  for (const msg of conv.messages) {
    if (msg.role === 'user') {
      appendUserTurn(msg.text || '');
    } else if (msg.role === 'assistant') {
      const astDiv = createAssistantTurnElement(msg);
      chatStream.appendChild(astDiv);
    }
  }
  attachStreamListeners();
  chatStream.scrollTop = chatStream.scrollHeight;
}

function appendUserTurn(text) {
  if (!chatStream) return;
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-turn user';
  userDiv.textContent = text;
  chatStream.appendChild(userDiv);
  chatStream.scrollTop = chatStream.scrollHeight;
}

function appendThinkingTurn() {
  if (!chatStream) return;
  removeThinkingTurn();
  const thinkDiv = document.createElement('div');
  thinkDiv.id = 'chat-thinking-turn';
  thinkDiv.className = 'chat-turn thinking';
  thinkDiv.innerHTML = `
    <span>Pointy is thinking</span>
    <div class="thinking-dots">
      <span class="thinking-dot"></span>
      <span class="thinking-dot"></span>
      <span class="thinking-dot"></span>
    </div>
  `;
  chatStream.appendChild(thinkDiv);
  chatStream.scrollTop = chatStream.scrollHeight;
}

function removeThinkingTurn() {
  const existing = document.getElementById('chat-thinking-turn');
  if (existing) existing.remove();
}

/**
 * Follow-up submission: Turns into a multi-turn chat when the user asks another question right after!
 */
function submitFollowUpQuestion() {
  if (!cardChatInput) return;
  const question = cardChatInput.value.trim();
  if (!question) return;

  cardChatInput.value = '';

  if (answerDismissTimer) {
    clearTimeout(answerDismissTimer);
    answerDismissTimer = null;
  }

  cursorAnswerCard.classList.remove('hidden');

  // It only becomes a chat when the user asks another question right after one question!
  if (!isChatModeActive) {
    isChatModeActive = true;
    cursorAnswerCard.classList.add('chat-mode');
    applyCardSizing('', true);

    // Reconstruct the previous turn so the user sees the ongoing conversation
    if (lastAnswerTurn) {
      chatStream.innerHTML = '';
      if (lastAnswerTurn.question) {
        appendUserTurn(lastAnswerTurn.question);
      }
      if (lastAnswerTurn.result) {
        const prevAst = createAssistantTurnElement(lastAnswerTurn.result);
        chatStream.appendChild(prevAst);
        attachStreamListeners();
      }
    }
  }

  appendUserTurn(question);
  appendThinkingTurn();

  setAppState('thinking');
  window.pointyAPI.sendTypedQuestion(question);
}

function handleFollowUpMicClick() {
  if (currentState === 'listening') {
    cardChatMic?.classList.remove('recording');
    stopVoiceSession();
  } else {
    if (answerDismissTimer) {
      clearTimeout(answerDismissTimer);
      answerDismissTimer = null;
    }

    if (!isChatModeActive && lastAnswerTurn) {
      isChatModeActive = true;
      cursorAnswerCard.classList.add('chat-mode');
      applyCardSizing('', true);
      chatStream.innerHTML = '';
      if (lastAnswerTurn.question) {
        appendUserTurn(lastAnswerTurn.question);
      }
      if (lastAnswerTurn.result) {
        const prevAst = createAssistantTurnElement(lastAnswerTurn.result);
        chatStream.appendChild(prevAst);
        attachStreamListeners();
      }
    }

    cardChatMic?.classList.add('recording');
    startVoiceSession();
  }
}

// ─── Pointing Animation & Target Placement ────────────────────────────
function handlePointAt(result, audioBase64 = null, conversation = null, question = null) {
  cancelStandbyGlide();
  if (answerDismissTimer) {
    clearTimeout(answerDismissTimer);
    answerDismissTimer = null;
  }

  aiCursor.classList.remove('thinking');
  cursorLoadingSpinner?.classList.add('hidden');
  cardChatMic?.classList.remove('recording');

  if (conversation) {
    activeConversation = conversation;
  }

  if (!result) {
    showAnswerBesideCursor("I couldn't process that question. Please try asking again!", null, false);
    return;
  }

  const answerContent = result.detailed_explanation || result.reply;

  if (isChatModeActive) {
    // In active chat mode: append the new answer into the stream!
    removeThinkingTurn();
    const newAstDiv = createAssistantTurnElement(result);
    chatStream.appendChild(newAstDiv);
    attachStreamListeners();
    chatStream.scrollTop = chatStream.scrollHeight;
    applyCardSizing('', true);
    lastAnswerTurn = { question, result, step: result.steps?.[0] || null };
  } else {
    // Single answer mode: save last turn
    lastAnswerTurn = { question, result, step: result.steps?.[0] || null };
  }

  // If question was not found and not a detailed explanation
  if (!result.found && !result.detailed_explanation) {
    const fallbackText = result.reply || "I couldn't locate what you asked for. Try asking another question!";
    positionBubbleAtCursor();
    showAnswerBesideCursor(fallbackText, null, isChatModeActive);
    if (audioBase64) {
      playAudioBase64(audioBase64, isChatModeActive);
    }
    return;
  }

  // If steps exist, point smoothly to the target
  if (result.steps && result.steps.length > 0) {
    currentSteps = result.steps;
    currentStepIndex = 0;
    pointToStep(0, answerContent, audioBase64, isChatModeActive, result, question);
  } else {
    currentSteps = [];
    currentStepIndex = 0;
    setAppState('pointing');
    if (audioBase64) {
      playAudioBase64(audioBase64, isChatModeActive);
    }
    if (!isChatModeActive) {
      positionBubbleAtCursor();
      renderSingleAnswer(result, question);
    }
  }
}

function pointToStep(index, fullText = null, audioBase64 = null, isChat = false, result = null, question = null) {
  cancelStandbyGlide();
  if (index >= currentSteps.length) {
    if (!isChat) {
      answerDismissTimer = setTimeout(() => resetToStandby(), 7000);
    }
    return;
  }

  const step = currentSteps[index];

  // Target coordinates
  const x = step.x || 0;
  const y = step.y || 0;
  const w = step.w || 80;
  const h = step.h || 36;

  // Target center
  const cx = Math.round(x + w / 2);
  const cy = Math.round(y + h / 2);

  // 1. Move cursor smoothly to target
  isFollowingMouse = false;
  aiCursor.classList.remove('following', 'idle', 'thinking');
  cursorLoadingSpinner?.classList.add('hidden');
  aiCursor.classList.add('flying');
  aiCursor.style.bottom = 'auto';
  aiCursor.style.right = 'auto';
  // Natural cursor tip offset (3.6px, 0.5px) for 26px cursor
  aiCursor.style.left = (cx - 3.6) + 'px';
  aiCursor.style.top = (cy - 0.5) + 'px';
  aiCursor.style.transform = 'rotate(0deg)';
  currentCursorPos = { x: cx, y: cy };
  currentRenderPos.x = cx;
  currentRenderPos.y = cy;
  currentTilt = 0;

  setAppState('pointing');

  // 2. Play Google Cloud TTS speech as cursor points!
  if (audioBase64) {
    playAudioBase64(audioBase64, isChat);
  } else {
    if (!isChat) {
      answerDismissTimer = setTimeout(() => {
        if (currentState === 'pointing') {
          resetToStandby();
        }
      }, 7500);
    }
  }

  // 3. Keep answer card hidden while flying
  cursorAnswerCard.classList.add('hidden');

  // When cursor arrives at target (~540ms), reveal answer speech bubble beside cursor
  setTimeout(() => {
    spawnParticles(cx, cy, 14);
    positionBubbleAtCursor(cx, cy);
    if (!isChat && result) {
      renderSingleAnswer(result, question);
    } else {
      const displayText = fullText || step.instruction || step.label || 'Here it is!';
      showAnswerBesideCursor(displayText, step, isChat);
    }
  }, 540);
}

function goToNextStep() {
  currentStepIndex++;
  if (currentStepIndex >= currentSteps.length) {
    resetToStandby();
  } else {
    pointToStep(currentStepIndex, null, null, isChatModeActive, lastAnswerTurn?.result, lastAnswerTurn?.question);
  }
}

// ─── Display Answer Text Inside Minimalist Outgoing Speech Bubble ────
function showAnswerBesideCursor(text, step, isChat = false) {
  if (text) {
    positionBubbleAtCursor();
    // When pointing at an element/step, never show chat actions — just show the pure text!
    const showChatActions = !step && !isChat;
    typeOutSpeechBubble(text, '', false, showChatActions);
  }
}

function repositionAnswerCard() {
  positionBubbleAtCursor();
}

// ─── Google Cloud TTS Audio Playback (High-fidelity voice) ───────────
function playAudioBase64(base64, isChat = false) {
  if (!base64) return;
  try {

    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    activeAudio = new Audio(url);

    const speakingIndicator = document.querySelector('.answer-speaking-indicator');
    activeAudio.onplay = () => {
      cursorAnswerCard.classList.remove('hidden');
      if (speakingIndicator) speakingIndicator.style.opacity = '1';
    };
    activeAudio.onended = () => {
      URL.revokeObjectURL(url);
      if (speakingIndicator) speakingIndicator.style.opacity = '0.3';

      if (!isChat) {
        answerDismissTimer = setTimeout(() => {
          if (currentState === 'pointing') {
            resetToStandby();
          }
        }, 7000);
      }
    };

    activeAudio.play().catch((e) => console.warn('[Pointy] Audio play failed:', e));
  } catch (error) {
    console.warn('[Pointy] Base64 audio playback error:', error);
  }
}

// ─── Reset to Standby (Follows cursor continuously) ──────────────────
function resetToStandby() {
  cancelStandbyGlide();
  if (answerDismissTimer) {
    clearTimeout(answerDismissTimer);
    answerDismissTimer = null;
  }

  const wasPointing = (currentState === 'pointing');
  currentState = 'idle';
  isFollowingMouse = true;

  // Reset multi-turn chat session state and manual resize overrides
  isChatModeActive = false;
  lastAnswerTurn = null;
  userHasManuallyResized = false;
  manualCardWidth = null;
  manualCardHeight = null;
  cursorAnswerCard.style.width = '';
  cursorAnswerCard.style.height = '';
  cursorAnswerCard.classList.remove('chat-mode', 'size-compact', 'size-medium', 'size-expanded', 'manually-resized', 'assistant-mode', 'is-speaking', 'details-open');

  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }

  if (activeStreamingTimer) {
    clearInterval(activeStreamingTimer);
    activeStreamingTimer = null;
  }

  if (activeTypingTimer) {
    clearInterval(activeTypingTimer);
    activeTypingTimer = null;
  }

  cursorAnswerCard.classList.add('hidden');
  cursorLoadingSpinner?.classList.add('hidden');
  hideTextInput();

  currentSteps = [];
  currentStepIndex = 0;
  finalTranscript = '';

  // Immediately rejoin and follow user's mouse position
  window.pointyAPI.getCursorPosition().then((pos) => {
    const mouseX = (pos && typeof pos.x === 'number') ? pos.x : window.innerWidth / 2;
    const mouseY = (pos && typeof pos.y === 'number') ? pos.y : window.innerHeight / 2;

    const targetX = Math.max(0, Math.min(mouseX + 16, window.innerWidth - 4));
    const targetY = Math.max(0, Math.min(mouseY + 14, window.innerHeight - 4));

    targetCursorPos.x = targetX;
    targetCursorPos.y = targetY;

    if (wasPointing) {
      // Smooth cinematic return glide back to user's cursor
      aiCursor.classList.remove('following', 'listening', 'thinking', 'pointing');
      aiCursor.classList.add('flying');
      aiCursor.style.left = (targetX - 3.6) + 'px';
      aiCursor.style.top = (targetY - 0.5) + 'px';
      aiCursor.style.transform = 'rotate(0deg)';

      setTimeout(() => {
        aiCursor.classList.remove('flying');
        aiCursor.classList.add('idle', 'following');
        currentRenderPos.x = targetX;
        currentRenderPos.y = targetY;
        currentTilt = 0;
        if (!isLerpLoopRunning) startLerpLoop();
      }, 420);
    } else {
      aiCursor.classList.remove('flying', 'listening', 'thinking', 'pointing');
      aiCursor.classList.add('idle', 'following');
      if (!isLerpLoopRunning) startLerpLoop();
    }
  }).catch(() => {});
}

// ─── Text Input Fallback ─────────────────────────────────────────────
function toggleTextInput() {
  if (textInputContainer.classList.contains('hidden')) {
    textInputContainer.classList.remove('hidden');
    window.pointyAPI.setIgnoreMouseEvents(false);
    setTimeout(() => {
      textInput.focus();
    }, 50);
  } else {
    hideTextInput();
  }
}

function hideTextInput() {
  textInputContainer.classList.add('hidden');
  textInput.value = '';
  window.pointyAPI.setIgnoreMouseEvents(true, { forward: true });
}

function submitTypedQuestion() {
  const query = textInput.value.trim();
  if (!query) return;

  hideTextInput();
  setAppState('thinking');

  // If the answer card was open when the user asked this question, it becomes a chat!
  const cardIsOpen = cursorAnswerCard && !cursorAnswerCard.classList.contains('hidden');
  if (isChatModeActive || (cardIsOpen && lastAnswerTurn)) {
    if (!isChatModeActive && lastAnswerTurn) {
      isChatModeActive = true;
      cursorAnswerCard.classList.add('chat-mode');
      applyCardSizing('', true);
      chatStream.innerHTML = '';
      if (lastAnswerTurn.question) {
        appendUserTurn(lastAnswerTurn.question);
      }
      if (lastAnswerTurn.result) {
        const prevAst = createAssistantTurnElement(lastAnswerTurn.result);
        chatStream.appendChild(prevAst);
        attachStreamListeners();
      }
    }
    appendUserTurn(query);
    appendThinkingTurn();
  }

  window.pointyAPI.sendTypedQuestion(query);
}

// ─── Particle Effects ────────────────────────────────────────────────
function spawnParticles(x, y, count = 12) {
  if (!particlesContainer) return;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';

    const size = Math.random() * 4 + 2;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = x + 'px';
    p.style.top = y + 'px';

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 45 + 15;
    const duration = Math.random() * 400 + 400;

    particlesContainer.appendChild(p);

    const animation = p.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`,
          opacity: 0,
        },
      ],
      { duration, easing: 'cubic-bezier(0, 0.7, 0.1, 1)' }
    );

    animation.onfinish = () => p.remove();
  }
}

// ─── Launch ──────────────────────────────────────────────────────────
init();
