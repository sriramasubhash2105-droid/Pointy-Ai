const axios = require('axios');

/**
 * Google Cloud Text-to-Speech Service
 * Uses Google Cloud TTS REST API v1.
 */
class GoogleTTSService {
  constructor(apiKey) {
    this.apiKey = (apiKey || '').trim();
    this.endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 5;
  }

  /**
   * Synthesize speech from text.
   * Returns base64 encoded audio or null on failure (which triggers browser TTS fallback).
   *
   * @param {string} text - Text to speak
   * @param {string} languageCode - e.g. 'en-US', 'hi-IN'
   * @returns {Promise<string|null>} Base64 audio string
   */
  async speak(text, languageCode = 'en-US') {
    if (!this.hasApiKey() || !text) return null;

    try {
      console.log(`[GoogleTTS] 🔊 Synthesizing speech for: "${text.slice(0, 40)}..."`);

      const response = await axios.post(
        `${this.endpoint}?key=${this.apiKey}`,
        {
          input: { text },
          voice: {
            languageCode: languageCode,
            // Ultra-fast high-fidelity Neural2 voice (230ms synthesis vs 4600ms Journey)
            name: languageCode === 'hi-IN' ? 'hi-IN-Neural2-A' : 'en-US-Neural2-F',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.05,
            pitch: 0.0,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.audioContent) {
        console.log('[GoogleTTS] ✅ Audio synthesized successfully');
        return response.data.audioContent;
      }
      return null;
    } catch (err) {
      console.warn('[GoogleTTS] Speech synthesis error:', err.response?.data?.error?.message || err.message);
      // Return null to gracefully fall back to Web Speech API in renderer
      return null;
    }
  }
}

module.exports = { GoogleTTSService };
