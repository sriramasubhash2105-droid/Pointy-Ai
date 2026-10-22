/**
 * ═══════════════════════════════════════════════════════════════════════
 * POINTY AI — Overlay Renderer
 * Handles the buddy mascot, cursor animation, recording, and pointing
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── DOM Elements ────────────────────────────────────────────────────
const buddy = document.getElementById('buddy');
const pointer = document.getElementById('pointer');
const targetRing = document.getElementById('target-ring');
const ringLabelText = document.getElementById('ring-label-text');
const statusPanel = document.getElementById('status-panel');
const statusText = document.getElementById('status-text');
const captionBar = document.getElementById('caption-bar');
const captionText = document.getElementById('caption-text');
const transcriptDisplay = document.getElementById('transcript-display');
const transcriptText = document.getElementById('transcript-text');
const textInputContainer = document.getElementById('text-input-container');
const textInput = document.getElementById('text-input');
const textSubmit = document.getElementById('text-submit');
const stepCounter = document.getElementById('step-counter');
const stepCurrent = document.getElementById('step-current');
const stepTotal = document.getElementById('step-total');
const stepNext = document.getElementById('step-next');
const stepSkip = document.getElementById('step-skip');
const particlesContainer = document.getElementById('particles');

// ─── State ───────────────────────────────────────────────────────────
let currentState = 'idle';
let mediaRecorder = null;
let audioChunks = [];
let currentStepIndex = 0;
let currentSteps = [];
let currentElements = [];
let displayInfo = null;
let buddyDragging = false;
let buddyOffset = { x: 0, y: 0 };
let isTextInputVisible = false;

// ─── Initialize ──────────────────────────────────────────────────────
async function init() {
  displayInfo = await window.pointyAPI.getDisplayInfo();
  setupEventListeners();
  setupIPCListeners();
  setupBuddyDrag();

  // Show text input on buddy double-click
  buddy.addEventListener('dblclick', toggleTextInput);

  console.log('[Pointy Overlay] Initialized', displayInfo);
}

// ─── Setup IPC Listeners ─────────────────────────────────────────────
function setupIPCListeners() {
  window.pointyAPI.onStateChange((state) => {
    setAppState(state);
  });

  window.pointyAPI.onStartRecording(() => {
    startRecording();
  });

  window.pointyAPI.onStopRecording(() => {
    stopRecording();
  });

  window.pointyAPI.onTranscript((data) => {
    showTranscript(data.text, data.lang);
  });

  window.pointyAPI.onPointAt((data) => {
    handlePointAt(data.result);
  });

  window.pointyAPI.onPlayAudio((audioBase64) => {
    playAudioBase64(audioBase64);
  });

  window.pointyAPI.onError((message) => {
    showError(message);
  });

  window.pointyAPI.onReset(() => {
    resetOverlay();
  });

  window.pointyAPI.onToggleBuddy((visible) => {
    buddy.style.display = visible ? 'block' : 'none';
  });

  window.pointyAPI.onSpeakFallback((data) => {
    speakFallback(data.text, data.lang);
  });
}

// ─── Setup Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
  // Text input handling
  textSubmit.addEventListener('click', submitTextQuestion);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTextQuestion();
    if (e.key === 'Escape') hideTextInput();
  });

  // Step navigation
  stepNext.addEventListener('click', nextStep);
  stepSkip.addEventListener('click', skipToEnd);

  // Make interactive elements toggle click-through
  const interactiveEls = document.querySelectorAll('.status-panel, .text-input-container, .step-counter, .buddy');
  interactiveEls.forEach(el => {
    el.addEventListener('mouseenter', () => {
      window.pointyAPI.setIgnoreMouseEvents(false);
    });
    el.addEventListener('mouseleave', () => {
      window.pointyAPI.setIgnoreMouseEvents(true, { forward: true });
    });
  });
}

// ─── Buddy Drag ──────────────────────────────────────────────────────
function setupBuddyDrag() {
  buddy.addEventListener('mousedown', (e) => {
    if (e.detail >= 2) return; // Ignore double-click
    buddyDragging = true;
    buddyOffset.x = e.clientX - buddy.offsetLeft;
    buddyOffset.y = e.clientY - buddy.offsetTop;
    buddy.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!buddyDragging) return;
    buddy.style.left = (e.clientX - buddyOffset.x) + 'px';
    buddy.style.top = (e.clientY - buddyOffset.y) + 'px';
    buddy.style.right = 'auto';
    buddy.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (buddyDragging) {
      buddyDragging = false;
      buddy.style.cursor = 'grab';
    }
  });
}

// ─── State Management ────────────────────────────────────────────────
function setAppState(state) {
  currentState = state;

  // Update buddy appearance
  buddy.className = `buddy ${state}`;

  // Update status panel
  statusPanel.className = `status-panel ${state}`;

  switch (state) {
    case 'idle':
      statusPanel.classList.add('hidden');
      hideTextInput();
      break;

    case 'listening':
      statusPanel.classList.remove('hidden');
      statusText.innerHTML = `
        <div class="sound-waves">
          <div class="sound-wave-bar"></div>
          <div class="sound-wave-bar"></div>
          <div class="sound-wave-bar"></div>
          <div class="sound-wave-bar"></div>
          <div class="sound-wave-bar"></div>
        </div>
        <span style="margin-left: 8px;">Listening... Press hotkey again to stop</span>
      `;
      break;

    case 'thinking':
      statusPanel.classList.remove('hidden');
      statusText.textContent = '🧠 Thinking...';
      break;

    case 'pointing':
      statusPanel.classList.remove('hidden');
      statusText.textContent = '🎯 Here it is!';
      break;
  }
}

// ─── Audio Recording ─────────────────────────────────────────────────
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      }
    });

    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());

      if (audioChunks.length === 0) return;

      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      window.pointyAPI.sendAudio(base64);
    };

    mediaRecorder.start(100);
    console.log('[Pointy] Recording started');
  } catch (error) {
    console.error('[Pointy] Mic error:', error);
    showError('Could not access microphone. Please allow microphone access.');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    console.log('[Pointy] Recording stopped');
  }
}

// ─── Text Input ──────────────────────────────────────────────────────
function toggleTextInput() {
  if (isTextInputVisible) {
    hideTextInput();
  } else {
    showTextInput();
  }
}

function showTextInput() {
  isTextInputVisible = true;
  textInputContainer.classList.remove('hidden');
  textInput.focus();
}

function hideTextInput() {
  isTextInputVisible = false;
  textInputContainer.classList.add('hidden');
  textInput.value = '';
}

function submitTextQuestion() {
  const question = textInput.value.trim();
  if (!question) return;

  hideTextInput();
  window.pointyAPI.sendTypedQuestion(question);
}

// ─── Pointing & Animation ────────────────────────────────────────────
function handlePointAt(result) {
  if (!result.found || !result.steps || result.steps.length === 0) {
    // Nothing found
    showCaption(result.reply || "I couldn't find what you're looking for.");
    setTimeout(() => resetOverlay(), 5000);
    return;
  }

  currentSteps = result.steps;
  currentStepIndex = 0;

  // Show reply caption
  if (result.reply) {
    showCaption(result.reply);
  }

  // Show step counter if multi-step
  if (currentSteps.length > 1) {
    showStepCounter(1, currentSteps.length);
  }

  // Point to first element
  pointToStep(0);
}

function pointToStep(stepIndex) {
  if (stepIndex >= currentSteps.length) {
    // All steps done
    setTimeout(() => resetOverlay(), 3000);
    return;
  }

  const step = currentSteps[stepIndex];

  // Gemini returns coordinates directly in each step
  const x = step.x || 0;
  const y = step.y || 0;
  const w = step.w || 60;
  const h = step.h || 30;

  // Center point
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Animate buddy flying to the target
  flyBuddyTo(x - 30, y - 60);

  // Animate pointer cursor
  animatePointerTo(cx, cy);

  // Show target ring
  showTargetRing(x, y, w, h, step.instruction || step.label || '');

  // Spawn particles at target
  setTimeout(() => spawnParticles(cx, cy, 12), 600);

  // Update step counter
  if (currentSteps.length > 1) {
    updateStepCounter(stepIndex + 1);
  }

  // Update caption with step instruction
  if (step.instruction) {
    showCaption(step.instruction);
  }
}

function nextStep() {
  currentStepIndex++;
  if (currentStepIndex >= currentSteps.length) {
    resetOverlay();
  } else {
    pointToStep(currentStepIndex);
  }
}

function skipToEnd() {
  resetOverlay();
}

// ─── Buddy Animation ────────────────────────────────────────────────
function flyBuddyTo(x, y) {
  buddy.classList.add('flying');

  // Clamp to screen bounds
  const maxX = window.innerWidth - 60;
  const maxY = window.innerHeight - 60;
  x = Math.max(10, Math.min(x, maxX));
  y = Math.max(10, Math.min(y, maxY));

  buddy.style.right = 'auto';
  buddy.style.bottom = 'auto';
  buddy.style.left = x + 'px';
  buddy.style.top = y + 'px';

  setTimeout(() => {
    buddy.classList.remove('flying');
  }, 800);
}

// ─── Pointer Animation ──────────────────────────────────────────────
function animatePointerTo(x, y) {
  pointer.classList.remove('hidden');

  // Start from buddy's position
  const buddyRect = buddy.getBoundingClientRect();
  pointer.style.left = buddyRect.left + 'px';
  pointer.style.top = buddyRect.top + 'px';

  // Enable animation after setting start position
  requestAnimationFrame(() => {
    pointer.classList.add('animate');
    pointer.style.left = (x - 8) + 'px';
    pointer.style.top = (y - 4) + 'px';
  });
}

// ─── Target Ring ─────────────────────────────────────────────────────
function showTargetRing(x, y, w, h, label) {
  const padding = 8;
  targetRing.classList.remove('hidden');
  targetRing.style.left = (x - padding) + 'px';
  targetRing.style.top = (y - padding) + 'px';
  targetRing.style.width = (w + padding * 2) + 'px';
  targetRing.style.height = (h + padding * 2) + 'px';

  ringLabelText.textContent = label;
}

function hideTargetRing() {
  targetRing.classList.add('hidden');
}

// ─── Caption & Transcript ────────────────────────────────────────────
function showCaption(text) {
  captionText.textContent = text;
  captionBar.classList.remove('hidden');
}

function hideCaption() {
  captionBar.classList.add('hidden');
}

function showTranscript(text, lang) {
  transcriptText.textContent = `"${text}" (${lang})`;
  transcriptDisplay.classList.remove('hidden');
}

function hideTranscript() {
  transcriptDisplay.classList.add('hidden');
}

// ─── Step Counter ────────────────────────────────────────────────────
function showStepCounter(current, total) {
  stepCurrent.textContent = current;
  stepTotal.textContent = total;
  stepCounter.classList.remove('hidden');
}

function updateStepCounter(current) {
  stepCurrent.textContent = current;
}

function hideStepCounter() {
  stepCounter.classList.add('hidden');
}

// ─── Error Display ───────────────────────────────────────────────────
function showError(message) {
  statusPanel.classList.remove('hidden');
  statusPanel.className = 'status-panel';
  statusText.textContent = `⚠️ ${message}`;

  setTimeout(() => {
    statusPanel.classList.add('hidden');
  }, 5000);
}

// ─── Particles ───────────────────────────────────────────────────────
function spawnParticles(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const distance = 30 + Math.random() * 50;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.setProperty('--dx', dx + 'px');
    particle.style.setProperty('--dy', dy + 'px');
    particle.style.width = (2 + Math.random() * 4) + 'px';
    particle.style.height = particle.style.width;

    // Random color from palette
    const colors = ['#7c3aed', '#2563eb', '#06b6d4', '#10b981', '#a78bfa'];
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];

    particle.style.animation = `particle-float ${0.6 + Math.random() * 0.4}s ease-out forwards`;

    particlesContainer.appendChild(particle);

    // Remove after animation
    setTimeout(() => particle.remove(), 1200);
  }
}

// ─── Audio Playback ──────────────────────────────────────────────────
function playAudioBase64(base64) {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch(e => console.warn('[Pointy] Audio play failed:', e));
    audio.onended = () => URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('[Pointy] Audio playback error:', error);
  }
}

// ─── Reset ───────────────────────────────────────────────────────────
function resetOverlay() {
  setAppState('idle');

  // Hide everything
  pointer.classList.add('hidden');
  pointer.classList.remove('animate');
  hideTargetRing();
  hideCaption();
  hideTranscript();
  hideStepCounter();
  hideTextInput();

  // Reset buddy position
  buddy.style.right = '40px';
  buddy.style.bottom = '80px';
  buddy.style.left = 'auto';
  buddy.style.top = 'auto';

  // Clear state
  currentSteps = [];
  currentStepIndex = 0;
  currentElements = [];

  window.pointyAPI.pointingComplete();
}

// ─── Speech Synthesis Fallback (when Timbre is not available) ─────────
function speakFallback(text, lang = 'en-IN') {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  }
}

// ─── Start ───────────────────────────────────────────────────────────
init();
