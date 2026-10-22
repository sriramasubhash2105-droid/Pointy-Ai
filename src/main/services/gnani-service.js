const axios = require('axios');
const FormData = require('form-data');

/**
 * Gnani AI Service
 * Wraps Prisma (STT) and Timbre (TTS) APIs only.
 * Reasoning is handled by Gemini Flash 2.5 (see gemini-service.js).
 *
 * Base URL: https://api.vachana.ai
 * Auth: X-API-Key-ID header
 */
class GnaniService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.vachana.ai';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-API-Key-ID': apiKey,
      },
      timeout: 30000,
    });
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Prisma STT - Transcribe audio to text
   * POST /stt/v3
   * multipart/form-data with audio_file and language_code
   */
  async transcribe(audioBuffer, languageCode = 'hi-IN') {
    try {
      const form = new FormData();
      form.append('audio_file', audioBuffer, {
        filename: 'recording.wav',
        contentType: 'audio/wav',
      });
      form.append('language_code', languageCode);

      const response = await this.client.post('/stt/v3', form, {
        headers: {
          ...form.getHeaders(),
          'X-API-Key-ID': this.apiKey,
        },
      });

      return {
        transcript: response.data.transcript || response.data.text || '',
        language: response.data.language || languageCode,
        confidence: response.data.confidence || 0,
      };
    } catch (error) {
      console.error('[GnaniService] Prisma STT error:', error.message);
      throw new Error(`Speech-to-text failed: ${error.message}`);
    }
  }

  /**
   * Timbre TTS - Speak the reply
   * POST /api/v1/tts/inference
   */
  async speak(text, language = 'en-IN') {
    try {
      // Map language codes to Timbre voice names
      const voiceMap = {
        'hi-IN': 'Nalini',
        'en-IN': 'Meera',
        'ta-IN': 'Kavitha',
        'te-IN': 'Lakshmi',
        'kn-IN': 'Padma',
        'ml-IN': 'Devika',
        'bn-IN': 'Sangita',
        'mr-IN': 'Asha',
        'gu-IN': 'Dhara',
        'pa-IN': 'Simran',
      };

      const voice = voiceMap[language] || 'Meera';

      const response = await this.client.post('/api/v1/tts/inference', {
        text: text,
        voice: voice,
        model: 'timbre-v2.5',
        language: language,
        speed: 1,
        audio_config: {
          encoding: 'linear_pcm',
          container: 'wav',
          num_channels: 1,
          sample_rate: 48000,
          sample_width: 2,
        },
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key-ID': this.apiKey,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('[GnaniService] Timbre TTS error:', error.message);
      // Don't throw - speaking is non-critical
      return null;
    }
  }
}

module.exports = { GnaniService };
