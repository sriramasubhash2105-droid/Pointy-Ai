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

async function testGeminiModels() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const audioBuffer = fs.readFileSync(path.join(__dirname, 'speech-sample.wav'));
  const base64Audio = audioBuffer.toString('base64');

  const models = [
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash'
  ];

  const prompts = [
    `You are a speech-to-text engine. Transcribe the words spoken in this audio. Output ONLY the words spoken. Never output timestamps, time codes (like 00:00), formatting, or notes. If there is no speech, output nothing.`,
  ];

  for (const model of models) {
    for (const prompt of prompts) {
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
        console.log(`[${model}] (${Date.now() - t0}ms) -> "${res.text?.trim()}"`);
      } catch (e) {
        console.log(`[${model}] Error:`, e.message);
      }
    }
  }
}

testGeminiModels();
