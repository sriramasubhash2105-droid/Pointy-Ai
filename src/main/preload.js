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

  // Typed question (alternative input)
  sendTypedQuestion: (question) => ipcRenderer.send('typed-question', question),

  // State changes
  onStateChange: (callback) => ipcRenderer.on('state-change', (_, state) => callback(state)),
  onTranscript: (callback) => ipcRenderer.on('transcript', (_, data) => callback(data)),
  onPointAt: (callback) => ipcRenderer.on('point-at', (_, data) => callback(data)),
  onPlayAudio: (callback) => ipcRenderer.on('play-audio', (_, audioBase64) => callback(audioBase64)),
  onError: (callback) => ipcRenderer.on('error', (_, message) => callback(message)),
  onReset: (callback) => ipcRenderer.on('reset', callback),
  onToggleBuddy: (callback) => ipcRenderer.on('toggle-buddy', (_, visible) => callback(visible)),
  onSpeakFallback: (callback) => ipcRenderer.on('speak-fallback', (_, data) => callback(data)),

  // Notify main process
  pointingComplete: () => ipcRenderer.send('pointing-complete'),
  requestReset: () => ipcRenderer.send('request-reset'),

  // Get display info
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
});
