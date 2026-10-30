const axios = require('axios');
const https = require('https');

/**
 * EasyVoice Text-to-Speech Service
 * Uses EasyVoice API (OpenAI-compatible) powered by the state-of-the-art Kokoro-82M model.
 * Base URL: https://easyvoice.ae/api/v1/audio/speech
 * Key prefix: ev_...
 * Features persistent Keep-Alive.
 */
class EasyVoiceTTSService {
  constructor(apiKey) {
    this.apiKey = (apiKey || '').trim();
    this.endpoint = 'https://easyvoice.ae/api/v1/audio/speech';
    this.agent = new https.Agent({
      keepAlive: true,
      maxSockets: 10,
      keepAliveMsecs: 120000,
    });
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.startsWith('ev_');
  }

  /**
   * Pre-warm the TLS connection on app launch
   */
  prewarm() {
    if (!this.hasApiKey()) return;
    try {
      const req = https.request('https://easyvoice.ae', {
        method: 'HEAD',
        agent: this.agent,
        timeout: 4000,
      }, (res) => {
        res.resume();
        console.log('[EasyVoice] 🔥 Persistent TLS connection pre-warmed');
      });
      req.on('error', () => {});
      req.end();
    } catch (_) {}
  }

  /**
   * Extract the primary spoken sentence from the reply text.
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
    return clean.slice(0, 90);
  }

  /**
   * Synthesize speech from text via EasyVoice Kokoro-82M.
   * Returns base64 encoded MP3 audio string or null if unavailable.
   *
   * @param {string} text - Text to speak
   * @param {string} [voiceOrLang='af_heart'] - Optional voice or language code
   * @returns {Promise<string|null>} Base64 audio string
   */
  async speak(text, voiceOrLang = 'af_heart') {
    if (!text || !this.hasApiKey()) return null;

    // Supported voices on EasyVoice; safely default to 'af_heart' if a language code like 'en-US' is passed
    const validVoices = new Set([
      'af_heart', 'af_aoede', 'af_bella', 'af_sky',
      'am_adam', 'am_michael', 'bf_emma', 'ar_m1', 'ar_f1'
    ]);
    const voice = (voiceOrLang && validVoices.has(voiceOrLang)) ? voiceOrLang : 'af_heart';

    try {
      console.log(`[EasyVoice] 🔊 Synthesizing speech with Kokoro voice "${voice}" ("${text.slice(0, 45)}...")...`);

      const response = await axios.post(
        this.endpoint,
        {
          model: 'kokoro-82m',
          input: text,
          voice: voice,
          response_format: 'mp3',
        },
        {
          httpsAgent: this.agent,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 7000,
        }
      );

      if (response.data && response.data.length > 0) {
        const base64 = Buffer.from(response.data).toString('base64');
        console.log(`[EasyVoice] ✅ Audio synthesized successfully (${response.data.length} bytes)`);
        return base64;
      }
    } catch (err) {
      console.warn('[EasyVoice] API notice:', err.response?.data?.error?.message || err.message);
    }

    return null;
  }
}

module.exports = { EasyVoiceTTSService };
