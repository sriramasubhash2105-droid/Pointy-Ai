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
});
