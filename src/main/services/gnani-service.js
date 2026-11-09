const WebSocket = require('ws');

/**
 * Gnani AI Service
 * Ultra-low latency Speech-to-Text (Prisma STT) and Text-to-Speech (Timbre TTS)
 * powered exclusively by Gnani AI WebSocket streaming APIs.
 *
 * STT WebSocket: wss://api.vachana.ai/stt/v3/stream
 * TTS WebSocket: wss://api.vachana.ai/api/v1/tts
 * Auth: X-API-Key-ID header / x-api-key-id
 */
class GnaniService {
  constructor(apiKey) {
    this.apiKey = (apiKey || '').trim();
    this.sttWsUrl = 'wss://api.vachana.ai/stt/v3/stream';
    this.ttsWsUrl = 'wss://api.vachana.ai/api/v1/tts';

    this._prewarmedSttWs = null;
    this._prewarmedSttTimer = null;
    this._prewarmedTtsWs = null;
    this._prewarmedTtsTimer = null;

    // Supported Timbre v2.5 voice mappings
    this.voiceMap = {
      'en-IN': 'Aarohi',
      'en-US': 'Aarohi',
      'en': 'Aarohi',
      'hi-IN': 'Nalini',
      'hi': 'Nalini',
      'ta-IN': 'Kaveri',
      'ta': 'Kaveri',
      'te-IN': 'Devika',
      'te': 'Devika',
      'kn-IN': 'Chitra',
      'kn': 'Chitra',
      'bn-IN': 'Radhika',
      'bn': 'Radhika',
      'mr-IN': 'Bhavna',
      'mr': 'Bhavna',
    };
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  setApiKey(apiKey) {
    this.apiKey = (apiKey || '').trim();
    this.closePrewarmedSTT();
    this.closePrewarmedTTS();
  }

  /**
   * Prewarm STT WebSocket connection as soon as user starts speaking.
   * Eliminates the ~3-second TLS/WebSocket handshake from the post-speech wait!
   */
  prewarmSTT(languageCode = 'en-IN') {
    if (!this.hasApiKey()) return;
    this.closePrewarmedSTT();

    try {
      const ws = new WebSocket(this.sttWsUrl, {
        headers: {
          'x-api-key-id': this.apiKey,
          'language_code': languageCode || 'en-IN',
          'x-sample-rate': '16000',
          'x-vad-threshold': '0.5',
          'x-min-silence-ms': '250',
          'format': 'verbatim',
        },
      });

      const idleTimer = setTimeout(() => {
        if (this._prewarmedSttWs === ws) {
          this._prewarmedSttWs = null;
          this.safeCloseWebSocket(ws);
        }
      }, 15000);

      this._prewarmedSttWs = ws;
      this._prewarmedSttTimer = idleTimer;

      ws.on('error', () => {
        if (this._prewarmedSttWs === ws) {
          clearTimeout(idleTimer);
          this._prewarmedSttWs = null;
        }
      });

      ws.on('close', () => {
        if (this._prewarmedSttWs === ws) {
          clearTimeout(idleTimer);
          this._prewarmedSttWs = null;
        }
      });
    } catch (_) {}
  }

  safeCloseWebSocket(ws) {
    if (!ws) return;
    try {
      ws.removeAllListeners();
      ws.on('error', () => {}); // Catch and swallow abort errors on nextTick
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    } catch (_) {}
  }

  closePrewarmedSTT() {
    if (this._prewarmedSttTimer) {
      clearTimeout(this._prewarmedSttTimer);
      this._prewarmedSttTimer = null;
    }
    if (this._prewarmedSttWs) {
      const ws = this._prewarmedSttWs;
      this._prewarmedSttWs = null;
      this.safeCloseWebSocket(ws);
    }
  }

  /**
   * Prewarm TTS WebSocket connection while Gemini is analyzing screen.
   * Eliminates TLS handshake latency when synthesizing speech!
   */
  prewarmTTS() {
    if (!this.hasApiKey()) return;
    this.closePrewarmedTTS();

    try {
      const ws = new WebSocket(this.ttsWsUrl, {
        headers: {
          'X-API-Key-ID': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      const idleTimer = setTimeout(() => {
        if (this._prewarmedTtsWs === ws) {
          this._prewarmedTtsWs = null;
          this.safeCloseWebSocket(ws);
        }
      }, 15000);

      this._prewarmedTtsWs = ws;
      this._prewarmedTtsTimer = idleTimer;

      ws.on('error', () => {
        if (this._prewarmedTtsWs === ws) {
          clearTimeout(idleTimer);
          this._prewarmedTtsWs = null;
        }
      });

      ws.on('close', () => {
        if (this._prewarmedTtsWs === ws) {
          clearTimeout(idleTimer);
          this._prewarmedTtsWs = null;
        }
      });
    } catch (_) {}
  }

  closePrewarmedTTS() {
    if (this._prewarmedTtsTimer) {
      clearTimeout(this._prewarmedTtsTimer);
      this._prewarmedTtsTimer = null;
    }
    if (this._prewarmedTtsWs) {
      const ws = this._prewarmedTtsWs;
      this._prewarmedTtsWs = null;
      this.safeCloseWebSocket(ws);
    }
  }

  /**
   * Parse audio buffer to extract raw PCM samples and detect native sample rate.
   * If a RIFF/WAVE header is detected, reads fmt chunk for sample rate and data chunk for PCM.
   */
  inspectAudioBuffer(buffer) {
    if (!buffer || buffer.length === 0) {
      return { pcm: Buffer.alloc(0), sampleRate: 16000 };
    }

    // Check for RIFF/WAVE container
    if (buffer.length > 44 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
      let offset = 12;
      let detectedSampleRate = 16000;
      let pcm = buffer.slice(44);

      while (offset < buffer.length - 8) {
        const chunkId = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        if (chunkId === 'fmt ' && chunkSize >= 16) {
          detectedSampleRate = buffer.readUInt32LE(offset + 12);
        } else if (chunkId === 'data') {
          const pcmStart = offset + 8;
          const pcmEnd = Math.min(buffer.length, pcmStart + chunkSize);
          pcm = buffer.slice(pcmStart, pcmEnd);
        }
        offset += 8 + chunkSize;
      }

      // Allowed Gnani STT sample rates: 8000, 16000, 44100, 48000
      const allowedRates = [8000, 16000, 44100, 48000];
      const validRate = allowedRates.includes(detectedSampleRate) ? detectedSampleRate : 16000;

      return { pcm, sampleRate: validRate };
    }

    // Raw linear PCM default
    return { pcm: buffer, sampleRate: 16000 };
  }

  /**
   * Extract raw PCM samples from audio buffer.
   */
  extractPcm(buffer) {
    return this.inspectAudioBuffer(buffer).pcm;
  }

  /**
   * Extract the primary spoken sentence from reply text.
   * Keeps speech concise so synthesis returns quickly.
   */
  extractFirstSentence(text) {
    if (!text) return '';
    const clean = text
      .replace(/[*_#`~\[\]]/g, '')
      .replace(/^[\s-*•\d.]+/g, '')
      .trim();

    const match = clean.match(/^([^.!?\n]+[.!?]?)/);
    if (match && match[1]) {
      const first = match[1].trim();
      const words = first.split(/\s+/).filter(Boolean);
      if (words.length < 3) {
        const twoMatch = clean.match(/^([^.!?\n]+[.!?]+[^.!?\n]+[.!?]?)/);
        if (twoMatch) return twoMatch[1].trim();
      }
      return first;
    }
    return clean.slice(0, 100);
  }

  /**
   * Prisma STT - Transcribe audio to text via WebSocket streaming
   * Endpoint: wss://api.vachana.ai/stt/v3/stream
   * Uses prewarmed WebSocket connection if available for sub-second transcription
   */
  async transcribe(audioBuffer, languageCode = 'en-IN') {
    if (!this.hasApiKey() || !audioBuffer || audioBuffer.length === 0) {
      return { transcript: '', language: languageCode };
    }

    const { pcm, sampleRate } = this.inspectAudioBuffer(audioBuffer);
    if (pcm.length === 0) {
      return { transcript: '', language: languageCode };
    }

    // Append 250ms of silence (tuned to match x-min-silence-ms: 250)
    // for immediate server-side VAD closure without lag
    const silenceBytes = Math.round(sampleRate * 2 * 0.25);
    const trailingSilence = Buffer.alloc(silenceBytes);
    const streamPayload = Buffer.concat([pcm, trailingSilence]);

    // Check for prewarmed socket
    let ws = null;
    if (this._prewarmedSttWs && (this._prewarmedSttWs.readyState === WebSocket.OPEN || this._prewarmedSttWs.readyState === WebSocket.CONNECTING)) {
      ws = this._prewarmedSttWs;
      this._prewarmedSttWs = null;
      if (this._prewarmedSttTimer) {
        clearTimeout(this._prewarmedSttTimer);
        this._prewarmedSttTimer = null;
      }
      try { ws.removeAllListeners(); } catch (_) {}
    }

    return new Promise((resolve) => {
      let overallTimer = null;
      let finishTimer = null;
      let resolved = false;
      const transcriptSegments = [];

      const cleanup = () => {
        if (overallTimer) {
          clearTimeout(overallTimer);
          overallTimer = null;
        }
        if (finishTimer) {
          clearTimeout(finishTimer);
          finishTimer = null;
        }
        if (ws) {
          this.safeCloseWebSocket(ws);
          ws = null;
        }
      };

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      // 8-second safety timeout
      overallTimer = setTimeout(() => {
        const finalTranscript = transcriptSegments.join(' ').trim();
        finish({ transcript: finalTranscript, language: languageCode });
      }, 8000);

      const sendAudioFrames = () => {
        const CHUNK_SIZE = 2048;
        let offset = 0;
        try {
          while (offset < streamPayload.length) {
            const chunk = streamPayload.slice(offset, offset + CHUNK_SIZE);
            ws.send(chunk);
            offset += CHUNK_SIZE;
          }
        } catch (sendErr) {
          console.error('[GnaniService] Error streaming STT frames:', sendErr.message);
        }

        // Safety timeout after all frames sent
        finishTimer = setTimeout(() => {
          const finalTranscript = transcriptSegments.join(' ').trim();
          finish({ transcript: finalTranscript, language: languageCode });
        }, 1200);
      };

      const attachHandlers = () => {
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'transcript') {
              const text = (msg.text || msg.transcript || '').trim();
              if (text) {
                transcriptSegments.push(text);
              }
              if (msg.is_final) {
                const finalTranscript = transcriptSegments.join(' ').trim();
                finish({ transcript: finalTranscript, language: languageCode });
              }
            } else if (msg.type === 'error') {
              console.error('[GnaniService] Prisma STT WS server error:', msg.message || msg);
              finish({ transcript: '', language: languageCode, error: msg.message || 'STT error' });
            }
          } catch (parseErr) {
            console.error('[GnaniService] STT WS parse error:', parseErr.message);
          }
        });

        ws.on('error', (err) => {
          console.error('[GnaniService] Prisma STT WS connection error:', err.message);
          finish({ transcript: '', language: languageCode, error: err.message });
        });

        ws.on('close', () => {
          const finalTranscript = transcriptSegments.join(' ').trim();
          finish({ transcript: finalTranscript, language: languageCode });
        });
      };

      try {
        if (ws) {
          attachHandlers();
          if (ws.readyState === WebSocket.OPEN) {
            sendAudioFrames();
          } else {
            ws.on('open', sendAudioFrames);
          }
        } else {
          ws = new WebSocket(this.sttWsUrl, {
            headers: {
              'x-api-key-id': this.apiKey,
              'language_code': languageCode || 'en-IN',
              'x-sample-rate': String(sampleRate),
              'x-vad-threshold': '0.5',
              'x-min-silence-ms': '250',
              'format': 'verbatim',
            },
          });
          attachHandlers();
          ws.on('open', sendAudioFrames);
        }
      } catch (err) {
        console.error('[GnaniService] Prisma STT WS initialization exception:', err.message);
        finish({ transcript: '', language: languageCode, error: err.message });
      }
    });
  }

  /**
   * Timbre TTS - Synthesize speech using Gnani AI WebSocket streaming
   * Endpoint: wss://api.vachana.ai/api/v1/tts
   * Supports real-time audio chunk streaming via onChunk callback (Time-to-First-Audio ~120ms!)
   * Returns base64 encoded audio string (WAV format) for overlay playback
   */
  async speak(text, language = 'en-IN', onChunk = null) {
    if (!text || !this.hasApiKey()) return null;

    const langKey = language.includes('-') ? language : `${language}-IN`;
    const voice = this.voiceMap[langKey] || this.voiceMap[language] || 'Aarohi';
    const actualLang = ['en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'bn-IN', 'mr-IN'].includes(langKey)
      ? langKey
      : 'en-IN';

    // Check for prewarmed socket
    let ws = null;
    if (this._prewarmedTtsWs && (this._prewarmedTtsWs.readyState === WebSocket.OPEN || this._prewarmedTtsWs.readyState === WebSocket.CONNECTING)) {
      ws = this._prewarmedTtsWs;
      this._prewarmedTtsWs = null;
      if (this._prewarmedTtsTimer) {
        clearTimeout(this._prewarmedTtsTimer);
        this._prewarmedTtsTimer = null;
      }
      try { ws.removeAllListeners(); } catch (_) {}
    }

    return new Promise((resolve) => {
      let timer = null;
      let resolved = false;
      const audioChunks = [];

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (ws) {
          this.safeCloseWebSocket(ws);
          ws = null;
        }
      };

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      // 8-second safety timeout
      timer = setTimeout(() => {
        console.warn('[GnaniService] Timbre TTS WS timeout');
        if (audioChunks.length > 0) {
          finish(Buffer.concat(audioChunks).toString('base64'));
        } else {
          finish(null);
        }
      }, 8000);

      const payload = JSON.stringify({
        text: text,
        voice: voice,
        model: 'timbre-v2.5',
        language: actualLang,
        speed: 1.0,
        audio_config: {
          sample_rate: 24000, // 24kHz wideband audio: 87% faster synthesis than 48kHz
          num_channels: 1,
          sample_width: 2,
          encoding: 'linear_pcm',
          container: 'wav',
        },
      });

      const attachHandlers = () => {
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'audio' && msg.data?.audio) {
              const chunkBuffer = Buffer.from(msg.data.audio, 'base64');
              audioChunks.push(chunkBuffer);

              // Stream chunk immediately to renderer for instant playback
              if (typeof onChunk === 'function') {
                try {
                  onChunk(msg.data.audio, audioChunks.length === 1);
                } catch (_) {}
              }
            } else if (msg.type === 'complete') {
              if (audioChunks.length > 0) {
                const completeWav = Buffer.concat(audioChunks);
                finish(completeWav.toString('base64'));
              } else {
                finish(null);
              }
            } else if (msg.type === 'error') {
              console.error('[GnaniService] Timbre TTS WS error:', msg.message || msg);
              finish(null);
            }
          } catch (parseErr) {
            console.error('[GnaniService] TTS WS parse error:', parseErr.message);
          }
        });

        ws.on('error', (err) => {
          console.error('[GnaniService] Timbre TTS WS connection error:', err.message);
          finish(null);
        });

        ws.on('close', () => {
          if (audioChunks.length > 0) {
            finish(Buffer.concat(audioChunks).toString('base64'));
          } else {
            finish(null);
          }
        });
      };

      try {
        if (ws) {
          attachHandlers();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          } else {
            ws.on('open', () => ws.send(payload));
          }
        } else {
          ws = new WebSocket(this.ttsWsUrl, {
            headers: {
              'X-API-Key-ID': this.apiKey,
              'Content-Type': 'application/json',
            },
          });
          attachHandlers();
          ws.on('open', () => ws.send(payload));
        }
      } catch (err) {
        console.error('[GnaniService] Timbre TTS WS initialization exception:', err.message);
        finish(null);
      }
    });
  }

  /**
   * Create a live real-time STT streaming session for continuous microphone feed.
   */
  createLiveStreamingSession({ languageCode = 'en-IN', onTranscript, onSpeechStart, onError, onClose } = {}) {
    if (!this.hasApiKey()) {
      throw new Error('Gnani API key missing');
    }

    const ws = new WebSocket(this.sttWsUrl, {
      headers: {
        'x-api-key-id': this.apiKey,
        'language_code': languageCode,
        'x-sample-rate': '16000',
        'x-vad-threshold': '0.5',
        'x-min-silence-ms': '250',
        'format': 'verbatim',
      },
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'speech_start' && typeof onSpeechStart === 'function') {
          onSpeechStart();
        } else if (msg.type === 'transcript' && typeof onTranscript === 'function') {
          onTranscript((msg.text || msg.transcript || '').trim(), !!msg.is_final);
        } else if (msg.type === 'error' && typeof onError === 'function') {
          onError(new Error(msg.message || 'Gnani STT error'));
        }
      } catch (e) {
        if (typeof onError === 'function') onError(e);
      }
    });

    if (typeof onError === 'function') {
      ws.on('error', onError);
    }
    if (typeof onClose === 'function') {
      ws.on('close', onClose);
    }

    let finishSilenceTimer = null;
    return {
      sendPcmChunk: (chunk) => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(chunk);
          } catch (_) {}
        }
      },
      finishWithSilence: () => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            // Append 500ms of silence (16000 * 2 * 0.5 = 16000 bytes) to close speech boundary immediately
            ws.send(Buffer.alloc(16000));
          } catch (_) {}
        }
        if (finishSilenceTimer) clearTimeout(finishSilenceTimer);
        finishSilenceTimer = setTimeout(() => {
          try { ws.close(); } catch (_) {}
        }, 1500);
      },
      close: () => {
        if (finishSilenceTimer) clearTimeout(finishSilenceTimer);
        this.safeCloseWebSocket(ws);
      },
      isOpen: () => ws.readyState === WebSocket.OPEN,
    };
  }
}

module.exports = { GnaniService };
