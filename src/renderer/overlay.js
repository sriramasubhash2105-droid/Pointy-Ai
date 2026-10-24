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
const answerCardFooter = document.getElementById('answer-card-footer');
const answerStepInfo = document.getElementById('answer-step-info');
const answerNextBtn = document.getElementById('answer-next-btn');
const answerSkipBtn = document.getElementById('answer-skip-btn');
const answerCloseBtn = document.getElementById('answer-close-btn');
const badgeTitle = document.getElementById('badge-title');

let currentAnswerMode = 'pointer'; // 'pointer' | 'assistant'
let answerDismissTimer = null;

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
  try {
    displayInfo = await window.pointyAPI.getDisplayInfo();
  } catch (e) {
    displayInfo = { size: { width: window.innerWidth, height: window.innerHeight } };
  }

  setupEventListeners();
  setupIPCListeners();
  setupSpeechRecognition();

  // Make sure cursor is in idle floating state on screen
  resetToStandby();

  console.log('[Pointy Spatial Cursor] Engine ready');
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
    handlePointAt(data.result, data.audioBase64);
  });

  window.pointyAPI.onPlayAudio((audioBase64) => {
    playAudioBase64(audioBase64);
  });

  window.pointyAPI.onError((message) => {
    aiCursor.classList.remove('thinking');
    cursorLoadingSpinner?.classList.add('hidden');
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
      '#cursor-answer-card, #text-input-container, button, input, .ai-cursor, .cursor-hover-menu'
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
  const clampX = Math.max(0, Math.min(x || window.innerWidth / 2, window.innerWidth - 10));
  const clampY = Math.max(0, Math.min(y || window.innerHeight / 2, window.innerHeight - 10));

  isFollowingMouse = true;
  aiCursor.classList.remove('idle', 'flying');
  aiCursor.classList.add('following');
  aiCursor.style.bottom = 'auto';
  aiCursor.style.right = 'auto';

  // Smooth companion offset (+8px, +6px) so user's original cursor pointer is 100% visible
  const targetX = clampX + 8;
  const targetY = clampY + 6;
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
  startVoiceSession();
}

// ─── Real-time Cursor Following (Tracks user's original cursor) ───────
function followOriginalCursor(mouseX, mouseY) {
  if (!isFollowingMouse || currentState === 'pointing' || currentState === 'idle') {
    return;
  }

  // Smooth companion offset (+8px right, +6px down)
  // Keeps the original OS mouse cursor unobstructed and visible
  const offsetX = 8;
  const offsetY = 6;

  let targetX = mouseX + offsetX;
  let targetY = mouseY + offsetY;

  // Screen boundary guards: allow smooth movement over taskbar without bouncing
  if (targetX + 24 > window.innerWidth) {
    targetX = mouseX - 26;
  }

  // Allow cursor to freely follow anywhere on the screen including the full taskbar!
  targetX = Math.max(0, Math.min(targetX, window.innerWidth - 2));
  targetY = Math.max(0, Math.min(targetY, window.innerHeight - 2));

  aiCursor.classList.remove('idle', 'flying');
  aiCursor.classList.add('following');
  aiCursor.style.bottom = 'auto';
  aiCursor.style.right = 'auto';
  aiCursor.style.left = (targetX - 3.6) + 'px';
  aiCursor.style.top = (targetY - 0.5) + 'px';

  currentCursorPos = { x: targetX, y: targetY };
}

// ─── Startup Intro Showcase ──────────────────────────────────────────
function playStartupIntro(mousePos) {
  const x = Math.min(Math.max(80, mousePos?.x || window.innerWidth / 2), window.innerWidth - 80);
  const y = Math.min(Math.max(80, mousePos?.y || window.innerHeight / 2), window.innerHeight - 80);

  currentCursorPos = { x, y };

  // Pop out Red Cursor right at user's mouse position!
  aiCursor.classList.remove('idle', 'flying');
  aiCursor.style.bottom = 'auto';
  aiCursor.style.right = 'auto';
  aiCursor.style.left = (x - 3.6) + 'px';
  aiCursor.style.top = (y - 0.5) + 'px';

  aiCursor.classList.remove('pop-out');
  void aiCursor.offsetWidth;
  aiCursor.classList.add('pop-out');

  cursorShockwave.classList.remove('animate');
  void cursorShockwave.offsetWidth;
  cursorShockwave.classList.add('animate');

  spawnParticles(x, y, 14);

  // Keep screen completely clean — NO text windows
  cursorAnswerCard.classList.add('hidden');

  // After 1.5 seconds, smoothly glide down into the idle standby corner
  setTimeout(() => {
    if (currentState === 'idle') {
      aiCursor.classList.add('flying');
      aiCursor.style.left = (window.innerWidth - 40) + 'px';
      aiCursor.style.top = (window.innerHeight - 40) + 'px';

      setTimeout(() => {
        resetToStandby();
      }, 500);
    }
  }, 1500);
}

// ─── State Management ────────────────────────────────────────────────
function setAppState(state) {
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
    return `<pre><code>${code.trim()}</code></pre>`;
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
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul>') || p.startsWith('<ol>')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

// ─── Pointing Animation & Target Placement ────────────────────────────
function handlePointAt(result, audioBase64 = null) {
  if (answerDismissTimer) {
    clearTimeout(answerDismissTimer);
    answerDismissTimer = null;
  }

  aiCursor.classList.remove('thinking');
  cursorLoadingSpinner?.classList.add('hidden');

  if (!result) {
    showAnswerBesideCursor("I couldn't process that question. Please try asking again!", null, false);
    answerDismissTimer = setTimeout(() => resetToStandby(), 5000);
    return;
  }

  const isAssistant = result.mode === 'assistant' ||
    (!result.mode && result.detailed_explanation && result.detailed_explanation.length > 120);
  currentAnswerMode = isAssistant ? 'assistant' : 'pointer';

  // If question was not found and not an assistant explanation
  if (!result.found && !isAssistant) {
    const fallbackText = result.reply || "I couldn't locate what you asked for. Try asking another question!";
    showAnswerBesideCursor(fallbackText, null, false);
    if (audioBase64) {
      playAudioBase64(audioBase64, false);
    } else {
      answerDismissTimer = setTimeout(() => resetToStandby(), 5500);
    }
    return;
  }

  const answerContent = isAssistant
    ? (result.detailed_explanation || result.reply)
    : (result.reply || result.detailed_explanation);

  // If steps exist, point to the target
  if (result.steps && result.steps.length > 0) {
    currentSteps = result.steps;
    currentStepIndex = 0;
    pointToStep(0, answerContent, audioBase64, isAssistant);
  } else {
    // Assistant mode without specific button target: stay in place and display explanation
    currentSteps = [];
    currentStepIndex = 0;
    setAppState('pointing');
    if (audioBase64) {
      playAudioBase64(audioBase64, isAssistant);
    } else {
      answerDismissTimer = setTimeout(() => {
        if (currentState === 'pointing') resetToStandby();
      }, isAssistant ? 35000 : 6000);
    }
    showAnswerBesideCursor(answerContent, null, isAssistant);
  }
}

function pointToStep(index, fullText = null, audioBase64 = null, isAssistant = false) {
  if (index >= currentSteps.length) {
    const delay = isAssistant ? 35000 : 4000;
    answerDismissTimer = setTimeout(() => resetToStandby(), delay);
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
  currentCursorPos = { x: cx, y: cy };

  setAppState('pointing');

  // 2. Play Google Cloud TTS speech as cursor points!
  if (audioBase64) {
    playAudioBase64(audioBase64, isAssistant);
  } else {
    // If TTS is unavailable, keep cursor pointing so user sees it clearly
    const delay = isAssistant ? 35000 : 6000;
    answerDismissTimer = setTimeout(() => {
      if (currentState === 'pointing') {
        resetToStandby();
      }
    }, delay);
  }

  // 3. Keep answer card hidden while flying
  cursorAnswerCard.classList.add('hidden');

  const displayText = fullText || step.instruction || step.label || 'Here it is!';

  // When cursor arrives at target (~420ms), reveal answer text card beside cursor
  setTimeout(() => {
    spawnParticles(cx, cy, 14);
    showAnswerBesideCursor(displayText, step, isAssistant);
  }, 420);
}

function goToNextStep() {
  currentStepIndex++;
  if (currentStepIndex >= currentSteps.length) {
    resetToStandby();
  } else {
    pointToStep(currentStepIndex, null, null, currentAnswerMode === 'assistant');
  }
}

// ─── Display Answer Text Beside Red Cursor ───────────────────────────
function showAnswerBesideCursor(text, step, isAssistant = false) {
  if (isAssistant) {
    cursorAnswerCard.classList.add('assistant-mode');
    if (badgeTitle) badgeTitle.textContent = 'Pointy Assistant';
    answerCardText.innerHTML = renderMarkdownToHtml(text);
  } else {
    cursorAnswerCard.classList.remove('assistant-mode');
    if (badgeTitle) badgeTitle.textContent = 'Pointy Navigator';
    answerCardText.textContent = text;
  }

  cursorAnswerCard.classList.remove('hidden');

  // Adjust positioning to stay on screen (Smart boundary detection)
  const cardWidth = isAssistant ? 460 : 320;
  const cardHeight = isAssistant ? 380 : 160;
  const cursorX = currentCursorPos.x;
  const cursorY = currentCursorPos.y;

  // Check if overflowing on right side
  if (cursorX + cardWidth + 50 > window.innerWidth) {
    cursorAnswerCard.classList.add('flipped-left');
  } else {
    cursorAnswerCard.classList.remove('flipped-left');
  }

  // Check vertical position so it doesn't run off bottom
  if (cursorY + cardHeight > window.innerHeight) {
    cursorAnswerCard.style.top = `-${cardHeight - 40}px`;
  } else {
    cursorAnswerCard.style.top = '-16px';
  }

  // Multi-step counter & buttons
  if (currentSteps && currentSteps.length > 1) {
    answerCardFooter.classList.remove('hidden');
    answerStepInfo.textContent = `Step ${currentStepIndex + 1} of ${currentSteps.length}`;
    if (currentStepIndex === currentSteps.length - 1) {
      answerNextBtn.textContent = 'Finish';
    } else {
      answerNextBtn.textContent = 'Next Step →';
    }
  } else {
    answerCardFooter.classList.add('hidden');
  }
}

// ─── Google Cloud TTS Audio Playback (High-fidelity voice) ───────────
function playAudioBase64(base64, isAssistant = false) {
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
      // For assistant explanations: keep open for 30 seconds so user can read!
      // For quick pointing: 4.5s is plenty.
      const readTime = isAssistant ? 30000 : 4500;
      answerDismissTimer = setTimeout(() => {
        if (currentState === 'pointing') {
          resetToStandby();
        }
      }, readTime);
    };

    activeAudio.play().catch((e) => console.warn('[Pointy] Audio play failed:', e));
  } catch (error) {
    console.warn('[Pointy] Base64 audio playback error:', error);
  }
}

// ─── Reset to Standby (Esc returns to right bottom side of window) ────
function resetToStandby() {
  if (answerDismissTimer) {
    clearTimeout(answerDismissTimer);
    answerDismissTimer = null;
  }

  isFollowingMouse = false;
  aiCursor.classList.remove('following', 'listening', 'thinking', 'pointing', 'pop-out');
  cursorAnswerCard.classList.remove('assistant-mode');

  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }

  // Smoothly glide cursor back to the right bottom side of the window (above taskbar)
  aiCursor.classList.remove('idle');
  aiCursor.classList.add('flying');
  aiCursor.style.left = (window.innerWidth - 75) + 'px';
  aiCursor.style.top = (window.innerHeight - 105) + 'px';

  setTimeout(() => {
    aiCursor.classList.remove('flying');
    aiCursor.style.left = 'auto';
    aiCursor.style.top = 'auto';
    aiCursor.style.bottom = '72px';
    aiCursor.style.right = '45px';
    aiCursor.classList.add('idle');
  }, 450);

  cursorAnswerCard.classList.add('hidden');
  cursorLoadingSpinner?.classList.add('hidden');
  hideTextInput();

  currentSteps = [];
  currentStepIndex = 0;
  finalTranscript = '';
  currentState = 'idle';

  window.pointyAPI.pointingComplete();
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

  // Pop out red cursor from current mouse location or center
  window.pointyAPI.getCursorPosition().then((pos) => {
    popOutCursor(pos.x, pos.y);
    submitVoiceQuestion(query);
  });
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
