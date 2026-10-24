const axios = require('axios');

/**
 * AssemblyAI Service (STT)
 * Used for speech-to-text transcription.
 * Uses AssemblyAI REST API v2.
 */
class AssemblyAIService {
  constructor(apiKey) {
    this.apiKey = (apiKey || '').trim();
    this.baseUrl = 'https://api.assemblyai.com/v2';
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 5;
  }

  /**
   * Transcribe an audio buffer (WAV/WebM) to text.
   * 1. Uploads binary audio buffer to /v2/upload
   * 2. Requests transcription from /v2/transcript
   * 3. Polls until completed
   *
   * @param {Buffer} audioBuffer
   * @returns {Promise<{ transcript: string, language: string }>}
   */
  async transcribe(audioBuffer) {
    if (!this.hasApiKey()) {
      throw new Error('AssemblyAI API key is missing');
    }

    try {
      console.log('[AssemblyAI] 📤 Uploading audio data (' + audioBuffer.length + ' bytes)...');

      // 1. Upload audio file
      const uploadRes = await axios.post(`${this.baseUrl}/upload`, audioBuffer, {
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/octet-stream',
        },
        maxContentLength: 50 * 1024 * 1024,
      });

      const uploadUrl = uploadRes.data.upload_url;
      console.log('[AssemblyAI] ✅ Audio uploaded. Requesting transcription...');

      // 2. Submit transcription job (universal-3-5-pro for speed & high accuracy)
      const transcriptRes = await axios.post(
        `${this.baseUrl}/transcript`,
        {
          audio_url: uploadUrl,
          speech_models: ['universal-3-5-pro', 'universal-2'],
        },
        {
          headers: {
            authorization: this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const transcriptId = transcriptRes.data.id;
      console.log(`[AssemblyAI] ⏳ Processing job ${transcriptId}...`);

      // 3. Poll status until completed or failed
      const pollingEndpoint = `${this.baseUrl}/transcript/${transcriptId}`;
      const startTime = Date.now();
      const timeoutMs = 25000;

      while (Date.now() - startTime < timeoutMs) {
        await new Promise((r) => setTimeout(r, 400));

        const pollRes = await axios.get(pollingEndpoint, {
          headers: {
            authorization: this.apiKey,
          },
        });

        const status = pollRes.data.status;
        if (status === 'completed') {
          const text = (pollRes.data.text || '').trim();
          console.log(`[AssemblyAI] 🎯 Transcribed: "${text}"`);
          return {
            transcript: text,
            language: pollRes.data.language_code || 'en-US',
            confidence: pollRes.data.confidence || 1.0,
          };
        } else if (status === 'error') {
          throw new Error(pollRes.data.error || 'AssemblyAI transcription failed');
        }
      }

      throw new Error('AssemblyAI transcription timed out');
    } catch (err) {
      console.error('[AssemblyAI] Transcription error:', err.response?.data || err.message);
      throw err;
    }
  }
}

module.exports = { AssemblyAIService };
