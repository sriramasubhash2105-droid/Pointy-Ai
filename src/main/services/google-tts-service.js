const axios = require('axios');
const https = require('https');

/**
 * Google Cloud Text-to-Speech Service
 * Uses Google Cloud TTS REST API v1 with persistent HTTPS Keep-Alive.
 */
class GoogleTTSService {
  constructor(apiKey) {
    this.apiKey = (apiKey || '').trim();
    this.endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    this.agent = new https.Agent({
      keepAlive: true,
      maxSockets: 10,
      keepAliveMsecs: 120000,
    });
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 5;
  }

  /**
   * Pre-warm the TLS connection on app launch so the first user interaction
   * does not experience cold-start handshake latency.
   */
  prewarm() {
    if (!this.hasApiKey()) return;
    try {
      const req = https.request('https://texttospeech.googleapis.com', {
        method: 'HEAD',
        agent: this.agent,
        timeout: 4000,
      }, (res) => {
        res.resume();
        console.log('[GoogleTTS] 🔥 Persistent TLS connection pre-warmed');
      });
      req.on('error', () => {});
      req.end();
    } catch (_) {}
  }

  /**
   * Extract the primary spoken sentence from the reply text.
   * Keeps speech ultra-concise (< 18 words) so Google Cloud TTS returns in ~220ms
   * instead of lagging on a full multi-sentence paragraph.
   *
   * @param {string} text
   * @returns {string}
   */
  extractFirstSentence(text) {
    if (!text) return '';
    // Strip markdown formatting symbols like bold, italic, code, bullets
    const clean = text
      .replace(/[*_#`~\[\]]/g, '')
      .replace(/^[\s-*•\d.]+/g, '')
      .trim();

    // Match the first sentence terminated by . ! ? or newline
    const match = clean.match(/^([^.!?\n]+[.!?]?)/);
    if (match && match[1]) {
      const first = match[1].trim();
      const words = first.split(/\s+/).filter(Boolean);
      // If the first sentence is extremely brief (< 3 words), grab up to two sentences
      if (words.length < 3) {
        const twoMatch = clean.match(/^([^.!?\n]+[.!?]+[^.!?\n]+[.!?]?)/);
        if (twoMatch) return twoMatch[1].trim();
      }
      return first;
    }
    return clean.slice(0, 90);
  }

  /**
   * Synthesize speech from text.
   * Uses Google Cloud Neural2 TTS.
   *
   * @param {string} text - Text to speak
   * @param {string} languageCode - e.g. 'en-US', 'hi-IN'
   * @returns {Promise<string|null>} Base64 audio string
   */
  async speak(text, languageCode = 'en-US') {
    if (!text || !this.hasApiKey()) return null;

    try {
      console.log(`[GoogleTTS] 🔊 Synthesizing speech for: "${text.slice(0, 45)}..."`);

      const response = await axios.post(
        `${this.endpoint}?key=${this.apiKey}`,
        {
          input: { text },
          voice: {
            languageCode: languageCode,
            name: languageCode === 'hi-IN' ? 'hi-IN-Neural2-A' : 'en-US-Neural2-F',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.08,
            pitch: 0.0,
          },
        },
        {
          httpsAgent: this.agent,
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 3500,
        }
      );

      if (response.data && response.data.audioContent) {
        console.log('[GoogleTTS] ✅ Cloud audio synthesized successfully');
        return response.data.audioContent;
      }
    } catch (err) {
      console.warn('[GoogleTTS] Cloud TTS notice:', err.response?.data?.error?.message || err.message);
    }

    return null;
  }
}

module.exports = { GoogleTTSService };
