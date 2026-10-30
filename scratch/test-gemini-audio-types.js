const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((l) => {
      const idx = l.indexOf('=');
      if (idx !== -1 && !l.trim().startsWith('#')) {
        process.env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
      }
    });
  }
}
loadEnv();

async function testGeminiAudio() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const audioBuffer = fs.readFileSync(path.join(__dirname, 'speech-sample.wav'));

  // Detect mime type:
  // WAV starts with RIFF (0x52 0x49 0x46 0x46)
  // WebM starts with 0x1A 0x45 0xDF 0xA3
  let mimeType = 'audio/wav';
  if (audioBuffer[0] === 0x1a && audioBuffer[1] === 0x45) {
    mimeType = 'audio/webm';
  }

  console.log(`Detected audio mime: ${mimeType}, size: ${audioBuffer.length} bytes`);

  const t0 = Date.now();
  const res = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: audioBuffer.toString('base64'),
              mimeType
            }
          },
          {
            text: 'Transcribe the spoken audio verbatim. Return ONLY the transcription text, nothing else. No formatting, no extra punctuation commentary, no markdown code block.'
          }
        ]
      }
    ]
  });

  console.log(`STT Response in ${Date.now() - t0}ms:`, res.text?.trim());
}

testGeminiAudio().catch(console.error);
