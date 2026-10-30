const WebSocket = require('ws');

class AssemblyAIStreamingService {
  constructor(apiKey) {
    this.apiKey = (apiKey || '').trim();
    this.ws = null;
    this.currentTranscript = '';
    this.onTranscriptCallback = null;
    this.isConnected = false;
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 5;
  }

  startSession(onTranscript) {
    if (!this.hasApiKey()) return Promise.reject(new Error('No AssemblyAI API key'));
    this.currentTranscript = '';
    this.onTranscriptCallback = onTranscript;

    const url = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000`;
    this.ws = new WebSocket(url, { headers: { Authorization: this.apiKey } });

    return new Promise((resolve, reject) => {
      let resolved = false;

      this.ws.on('open', () => {
        this.isConnected = true;
        console.log('[AssemblyAI Stream] ✅ Connected to v3 WebSocket');
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.transcript) {
            this.currentTranscript = msg.transcript;
            if (this.onTranscriptCallback) {
              this.onTranscriptCallback(this.currentTranscript, msg.end_of_turn);
            }
          }
        } catch (_) {}
      });

      this.ws.on('error', (err) => {
        console.warn('[AssemblyAI Stream] WebSocket error:', err.message);
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
      });
    });
  }

  sendAudioChunk(chunkBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunkBuffer);
    }
  }

  async stopSession() {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return resolve(this.currentTranscript.trim());
      }

      const timeout = setTimeout(() => {
        try { this.ws.close(); } catch (_) {}
        resolve(this.currentTranscript.trim());
      }, 1500);

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'Termination' || msg.message_type === 'SessionTerminated') {
            clearTimeout(timeout);
            try { this.ws.close(); } catch (_) {}
            resolve(this.currentTranscript.trim());
          }
        } catch (_) {}
      });

      try {
        this.ws.send(JSON.stringify({ type: 'Terminate' }));
      } catch (_) {
        clearTimeout(timeout);
        resolve(this.currentTranscript.trim());
      }
    });
  }
}

module.exports = { AssemblyAIStreamingService };
