const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(l => {
      const idx = l.indexOf('=');
      if (idx !== -1 && !l.trim().startsWith('#')) {
        process.env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
      }
    });
  }
}
loadEnv();

async function testSilentAudio() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  // Create a 1.5s silent WAV
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = sampleRate * numChannels * (bitsPerSample / 8) * 1.5;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const base64Audio = buffer.toString('base64');

  const models = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash-preview'];

  const prompt = `You are a high-precision speech-to-text transcription engine.
Transcribe the English words spoken in this audio buffer verbatim.
Rules:
1. Output ONLY the words spoken.
2. If there is no speech, silence, background noise, breathing, or unclear murmuring, return an empty string "".
3. NEVER output timestamps, time codes (like 00:00 or 0:00), subtitles, notes, explanations, or quotes.`;

  for (const model of models) {
    const t0 = Date.now();
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: base64Audio, mimeType: 'audio/wav' } },
              { text: prompt }
            ]
          }
        ]
      });
      console.log(`[${model}] Silent audio result (${Date.now() - t0}ms): "${res.text?.trim()}"`);
    } catch (e) {
      console.log(`[${model}] Error:`, e.message);
    }
  }
}

testSilentAudio();
