const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pointyAPI', {
  // Mouse event passthrough control
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },

  // Audio recording
  onStartRecording: (callback) => ipcRenderer.on('start-recording', callback),
  onStopRecording: (callback) => ipcRenderer.on('stop-recording', callback),
  sendAudio: (audioBase64) => ipcRenderer.send('audio-recorded', audioBase64),

  // Typed or transcribed question
  sendTypedQuestion: (question) => ipcRenderer.send('typed-question', question),

  // State changes & events
  onStateChange: (callback) => ipcRenderer.on('state-change', (_, state) => callback(state)),
  onTranscript: (callback) => ipcRenderer.on('transcript', (_, data) => callback(data)),
  onPointAt: (callback) => ipcRenderer.on('point-at', (_, data) => callback(data)),
  onPlayAudio: (callback) => ipcRenderer.on('play-audio', (_, audioBase64) => callback(audioBase64)),
  onError: (callback) => ipcRenderer.on('error', (_, message) => callback(message)),
  onReset: (callback) => ipcRenderer.on('reset', callback),
  onSpeakFallback: (callback) => ipcRenderer.on('speak-fallback', (_, data) => callback(data)),

  // Red AI Cursor Pop-out event (from user's mouse position)
  onPopOutCursor: (callback) => ipcRenderer.on('pop-out-cursor', (_, pos) => callback(pos)),
  onStartupIntro: (callback) => ipcRenderer.on('startup-intro', (_, pos) => callback(pos)),
  onCursorFollow: (callback) => ipcRenderer.on('cursor-follow', (_, pos) => callback(pos)),
  onToggleTextInput: (callback) => ipcRenderer.on('toggle-text-input', callback),
  triggerVoiceSummon: () => ipcRenderer.send('trigger-voice-summon'),
  triggerDictation: () => ipcRenderer.send('trigger-dictation'),
  sendDictationText: (text) => ipcRenderer.send('dictation-transcribed', text),
  onStartDictation: (callback) => ipcRenderer.on('start-dictation', (_, pos) => callback(pos)),
  onDictationResult: (callback) => ipcRenderer.on('dictation-result', (_, data) => callback(data)),

  // Notify main process
  pointingComplete: () => ipcRenderer.send('pointing-complete'),
  requestReset: () => ipcRenderer.send('request-reset'),

  // Screen & cursor information
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),

  // Conversation Memory & Sessions
  getActiveConversation: () => ipcRenderer.invoke('get-active-conversation'),
  startNewChat: () => ipcRenderer.invoke('start-new-chat'),
  getAllConversations: () => ipcRenderer.invoke('get-all-conversations'),
  switchConversation: (id) => ipcRenderer.invoke('switch-conversation', id),
  onConversationUpdated: (callback) => ipcRenderer.on('conversation-updated', (_, data) => callback(data)),

  // Multi-step Guidance (Settings -> Target, Menus -> Submenus)
  advanceMultiStep: () => ipcRenderer.invoke('advance-multi-step'),
  cancelMultiStep: () => ipcRenderer.invoke('cancel-multi-step'),
  onMultiStepWaiting: (callback) => ipcRenderer.on('multi-step-waiting', (_, data) => callback(data)),
  onMultiStepLoading: (callback) => ipcRenderer.on('multi-step-loading', (_, data) => callback(data)),
  onMultiStepError: (callback) => ipcRenderer.on('multi-step-error', (_, data) => callback(data)),
});

// Full ChatGPT Desktop Application API
contextBridge.exposeInMainWorld('chatAPI', {
  getConversations: () => ipcRenderer.invoke('chat-get-conversations'),
  getConversation: (id) => ipcRenderer.invoke('chat-get-conversation', id),
  createConversation: (title) => ipcRenderer.invoke('chat-create-conversation', title),
  switchConversation: (id) => ipcRenderer.invoke('chat-switch-conversation', id),
  deleteConversation: (id) => ipcRenderer.invoke('chat-delete-conversation', id),
  renameConversation: (id, title) => ipcRenderer.invoke('chat-rename-conversation', id, title),
  clearAllConversations: () => ipcRenderer.invoke('chat-clear-all-conversations'),
  sendMessage: (convIdOrPayload, text, options) => {
    if (typeof convIdOrPayload === 'object') {
      return ipcRenderer.invoke('chat-send-message', convIdOrPayload);
    }
    return ipcRenderer.invoke('chat-send-message', {
      convId: convIdOrPayload,
      text,
      model: options?.model,
      attachScreen: options?.attachScreen || options?.screenshot,
    });
  },
  getApiKeys: () => ipcRenderer.invoke('chat-get-api-keys'),
  saveApiKeys: (keys) => ipcRenderer.invoke('chat-save-api-keys', keys),
  testGeminiKey: (apiKey) => ipcRenderer.invoke('chat-test-gemini-key', apiKey),
  speakText: (text) => ipcRenderer.invoke('chat-speak-text', text),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  toggleOverlay: () => ipcRenderer.invoke('chat-toggle-overlay'),
  isOverlayActive: () => ipcRenderer.invoke('chat-is-overlay-active'),
  onConversationUpdated: (callback) => ipcRenderer.on('conversation-updated', (_, data) => callback(data)),
  onApiKeysUpdated: (callback) => ipcRenderer.on('api-keys-updated', (_, data) => callback(data)),
});
