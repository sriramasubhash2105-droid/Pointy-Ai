const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

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
    this._persistentTtsWs = null;
    this._ttsKeepAliveTimer = null;
    this._ttsQueue = Promise.resolve();
    if (this.hasApiKey()) {
      this.initPersistentTtsWs();
    }

    this._audioCache = new Map();
    this._cacheFile = path.join(__dirname, '../../../pointy_tts_cache.json');
    this._saveTimer = null;
    this.loadAudioCache();

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

  loadAudioCache() {
    try {
      if (fs.existsSync(this._cacheFile)) {
        const raw = fs.readFileSync(this._cacheFile, 'utf8');
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'string' && v.length > 100) {
            this._audioCache.set(k, v);
          }
        }
      }
    } catch (_) {}
  }

  saveAudioCacheDebounced() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        const obj = Object.fromEntries(this._audioCache);
        fs.writeFileSync(this._cacheFile, JSON.stringify(obj), 'utf8');
      } catch (_) {}
    }, 2000);
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
   * Standing persistent warm TTS WebSocket connection.
   * Eliminates the ~3.5-second TLS & pod allocation handshake completely!
   * First audio chunk arrives in ~160ms!
   */
  initPersistentTtsWs() {
    if (!this.hasApiKey()) return;
    if (this._persistentTtsWs && (this._persistentTtsWs.readyState === WebSocket.OPEN || this._persistentTtsWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const ws = new WebSocket(this.ttsWsUrl, {
        headers: {
          'X-API-Key-ID': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      this._persistentTtsWs = ws;

      ws.on('open', () => {
        console.log('[GnaniService] ⚡ Standing persistent Warm TTS WebSocket connected and ready!');
        this._startTtsKeepAlive();
      });

      ws.on('error', (err) => {
        console.warn('[GnaniService] Persistent TTS WS notice:', err.message);
      });

      ws.on('close', () => {
        this._stopTtsKeepAlive();
        if (this._persistentTtsWs === ws) {
          this._persistentTtsWs = null;
        }
        // Auto-reconnect after 1 second so socket is ALWAYS warm!
        setTimeout(() => {
          if (!this._persistentTtsWs && this.hasApiKey()) {
            this.initPersistentTtsWs();
          }
        }, 1000);
      });
    } catch (e) {
      console.warn('[GnaniService] Failed to init persistent TTS socket:', e.message);
    }
  }

  _startTtsKeepAlive() {
    this._stopTtsKeepAlive();
    this._ttsKeepAliveTimer = setInterval(() => {
      if (this._persistentTtsWs && this._persistentTtsWs.readyState === WebSocket.OPEN) {
        try {
          this._persistentTtsWs.ping();
        } catch (_) {}
      }
    }, 25000);
  }

  _stopTtsKeepAlive() {
    if (this._ttsKeepAliveTimer) {
      clearInterval(this._ttsKeepAliveTimer);
      this._ttsKeepAliveTimer = null;
    }
  }

  closePersistentTTS() {
    this._stopTtsKeepAlive();
    if (this._persistentTtsWs) {
      const ws = this._persistentTtsWs;
      this._persistentTtsWs = null;
      this.safeCloseWebSocket(ws);
    }
  }

  prewarmTTS() {
    this.initPersistentTtsWs();
  }

  closePrewarmedTTS() {
    // Standing persistent socket is intentionally kept warm!
    // No-op to preserve warm connection between turns.
  }

  async getWarmTtsWs() {
    if (!this.hasApiKey()) return null;
    if (this._persistentTtsWs && this._persistentTtsWs.readyState === WebSocket.OPEN) {
      return this._persistentTtsWs;
    }

    this.initPersistentTtsWs();

    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this._persistentTtsWs && this._persistentTtsWs.readyState === WebSocket.OPEN) {
          clearInterval(checkInterval);
          resolve(this._persistentTtsWs);
        } else if (!this._persistentTtsWs || Date.now() - startTime > 4000) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 25);
    });
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
   * Powered by Standing Persistent Warm WebSocket (Time-to-First-Audio ~160ms!)
   * Returns base64 encoded audio string (WAV format) for overlay playback
   */
  async speak(text, language = 'en-IN', onChunk = null) {
    if (!text || !this.hasApiKey()) return null;

    const langKey = language.includes('-') ? language : `${language}-IN`;
    const voice = this.voiceMap[langKey] || this.voiceMap[language] || 'Aarohi';
    const actualLang = ['en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'bn-IN', 'mr-IN'].includes(langKey)
      ? langKey
      : 'en-IN';

    const cleanText = text.trim();
    const cacheKey = `${voice}_${cleanText.toLowerCase()}`;

    // ⚡ Instant Cache Hit (0ms Audio Latency for Common Desktop Replies!)
    if (this._audioCache && this._audioCache.has(cacheKey)) {
      const cachedBase64 = this._audioCache.get(cacheKey);
      if (typeof onChunk === 'function') {
        try { onChunk(cachedBase64, true); } catch (_) {}
      }
      return Promise.resolve(cachedBase64);
    }

    // Sequential synthesis queue to prevent frame interleaving
    return new Promise((resolve) => {
      this._ttsQueue = this._ttsQueue.then(() => {
        return this._executeSpeak(cleanText, voice, actualLang, cacheKey, onChunk);
      }).then(resolve).catch((err) => {
        console.warn('[GnaniService] TTS speak queue notice:', err);
        resolve(null);
      });
    });
  }

  async _executeSpeak(text, voice, actualLang, cacheKey, onChunk) {
    const ws = await this.getWarmTtsWs();
    if (!ws) {
      console.warn('[GnaniService] No warm TTS WebSocket available, attempting fallback...');
      return this._fallbackSpeak(text, voice, actualLang, cacheKey, onChunk);
    }

    return new Promise((resolve) => {
      let timer = null;
      let trailingFlushTimer = null;
      let resolved = false;
      const audioChunks = [];

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (trailingFlushTimer) {
          clearTimeout(trailingFlushTimer);
          trailingFlushTimer = null;
        }
        try {
          ws.off('message', onMessage);
          ws.off('error', onError);
          ws.off('close', onClose);
        } catch (_) {}
      };

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      // 6-second overall safety timeout
      timer = setTimeout(() => {
        console.warn('[GnaniService] Persistent TTS WS timeout');
        if (audioChunks.length > 0) {
          finish(Buffer.concat(audioChunks).toString('base64'));
        } else {
          finish(null);
        }
      }, 6000);

      const finalizeUtterance = () => {
        if (audioChunks.length > 0) {
          const completeWav = Buffer.concat(audioChunks);
          const base64Audio = completeWav.toString('base64');
          if (text.length < 250 && this._audioCache) {
            this._audioCache.set(cacheKey, base64Audio);
            this.saveAudioCacheDebounced();
          }
          finish(base64Audio);
        } else {
          finish(null);
        }
      };

      const onMessage = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'audio' && msg.data?.audio) {
            const chunkBuffer = Buffer.from(msg.data.audio, 'base64');
            audioChunks.push(chunkBuffer);

            // Stream chunk immediately to renderer for instant playback (~160ms Time-to-First-Audio!)
            if (typeof onChunk === 'function') {
              try {
                onChunk(msg.data.audio, audioChunks.length === 1);
              } catch (_) {}
            }
          } else if (msg.type === 'complete') {
            if (msg.data?.audio) {
              const chunkBuffer = Buffer.from(msg.data.audio, 'base64');
              audioChunks.push(chunkBuffer);
              if (typeof onChunk === 'function') {
                try {
                  onChunk(msg.data.audio, audioChunks.length === 1);
                } catch (_) {}
              }
            }

            // Gnani sends a final {"type":"complete","message":"Streaming completed"} to cleanly finish
            if (msg.message === 'Streaming completed') {
              finalizeUtterance();
            } else {
              // Safety fallback: if final "Streaming completed" is delayed, flush after 150ms
              if (trailingFlushTimer) clearTimeout(trailingFlushTimer);
              trailingFlushTimer = setTimeout(() => {
                finalizeUtterance();
              }, 150);
            }
          } else if (msg.type === 'error') {
            console.error('[GnaniService] Timbre TTS WS error:', msg.message || msg);
            finish(null);
          }
        } catch (parseErr) {
          console.error('[GnaniService] TTS WS parse error:', parseErr.message);
        }
      };

      const onError = (err) => {
        console.error('[GnaniService] Persistent TTS WS error during speak:', err.message);
        finish(null);
      };

      const onClose = () => {
        finalizeUtterance();
      };

      ws.on('message', onMessage);
      ws.once('error', onError);
      ws.once('close', onClose);

      try {
        ws.send(JSON.stringify({
          text: text,
          voice: voice,
          model: 'timbre-v2.5',
          language: actualLang,
          speed: 1.0,
          audio_config: {
            sample_rate: 24000,
            num_channels: 1,
            sample_width: 2,
            encoding: 'linear_pcm',
            container: 'wav',
          },
        }));
      } catch (sendErr) {
        console.error('[GnaniService] Failed to send speak payload:', sendErr.message);
        finish(null);
      }
    });
  }

  async _fallbackSpeak(text, voice, actualLang, cacheKey, onChunk) {
    return new Promise((resolve) => {
      let timer = null;
      let resolved = false;
      let ws = null;
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

      timer = setTimeout(() => {
        if (audioChunks.length > 0) {
          finish(Buffer.concat(audioChunks).toString('base64'));
        } else {
          finish(null);
        }
      }, 7000);

      try {
        ws = new WebSocket(this.ttsWsUrl, {
          headers: {
            'X-API-Key-ID': this.apiKey,
            'Content-Type': 'application/json',
          },
        });

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'audio' && msg.data?.audio) {
              const chunkBuffer = Buffer.from(msg.data.audio, 'base64');
              audioChunks.push(chunkBuffer);
              if (typeof onChunk === 'function') {
                try { onChunk(msg.data.audio, audioChunks.length === 1); } catch (_) {}
              }
            } else if (msg.type === 'complete') {
              if (audioChunks.length > 0) {
                const completeWav = Buffer.concat(audioChunks);
                const base64Audio = completeWav.toString('base64');
                if (text.length < 250 && this._audioCache) {
                  this._audioCache.set(cacheKey, base64Audio);
                  this.saveAudioCacheDebounced();
                }
                finish(base64Audio);
              } else {
                finish(null);
              }
            } else if (msg.type === 'error') {
              finish(null);
            }
          } catch (_) {
            finish(null);
          }
        });

        ws.on('error', () => finish(null));
        ws.on('close', () => {
          if (audioChunks.length > 0) {
            finish(Buffer.concat(audioChunks).toString('base64'));
          } else {
            finish(null);
          }
        });

        ws.on('open', () => {
          try {
            ws.send(JSON.stringify({
              text: text,
              voice: voice,
              model: 'timbre-v2.5',
              language: actualLang,
              speed: 1.0,
              audio_config: {
                sample_rate: 24000,
                num_channels: 1,
                sample_width: 2,
                encoding: 'linear_pcm',
                container: 'wav',
              },
            }));
          } catch (_) {
            finish(null);
          }
        });
      } catch (err) {
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

    // Buffer chunks received while WebSocket is connecting (~150-250ms handshake)
    // to prevent losing the initial syllables or words of speech!
    const pendingChunks = [];

    ws.on('open', () => {
      while (pendingChunks.length > 0) {
        const chunk = pendingChunks.shift();
        try {
          if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
        } catch (_) {}
      }
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
        } else if (ws.readyState === WebSocket.CONNECTING) {
          pendingChunks.push(chunk);
        }
      },
      finishWithSilence: () => {
        const silence = Buffer.alloc(8000); // 250ms silence for immediate VAD closure
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(silence);
          } catch (_) {}
        } else if (ws.readyState === WebSocket.CONNECTING) {
          pendingChunks.push(silence);
        }
        if (finishSilenceTimer) clearTimeout(finishSilenceTimer);
        finishSilenceTimer = setTimeout(() => {
          try {
            if (ws.readyState === WebSocket.OPEN) ws.close();
          } catch (_) {}
        }, 1500);
      },
      close: () => {
        if (finishSilenceTimer) clearTimeout(finishSilenceTimer);
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.once('open', () => {
            try { ws.close(); } catch (_) {}
          });
        } else {
          this.safeCloseWebSocket(ws);
        }
      },
      isOpen: () => ws.readyState === WebSocket.OPEN,
    };
  }
}

module.exports = { GnaniService };
