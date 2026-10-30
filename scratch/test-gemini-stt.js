const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });
  }
}
loadEnv();

async function testGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('No GEMINI_API_KEY');
    return;
  }
  const ai = new GoogleGenAI({ apiKey });
  const audioBuffer = fs.readFileSync(path.join(__dirname, 'speech-sample.wav'));
  const base64Audio = audioBuffer.toString('base64');

  const models = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.5-flash-preview',
    'gemini-3-flash-preview',
    'gemini-1.5-pro'
  ];

  for (const model of models) {
    const t0 = Date.now();
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Audio,
                  mimeType: 'audio/wav'
                }
              },
              {
                text: 'Transcribe this audio verbatim. Output only the transcription, nothing else.'
              }
            ]
          }
        ]
      });
      const dur = Date.now() - t0;
      console.log(`✅ [${model}] ${dur}ms -> "${res.text?.trim()}"`);
    } catch (e) {
      console.log(`❌ [${model}] Error: ${e.message}`);
    }
  }
}

testGeminiModels();
