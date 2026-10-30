const fs = require('fs');
const path = require('path');
const { GoogleTTSService } = require('../src/main/services/google-tts-service');
const { AssemblyAIService } = require('../src/main/services/assemblyai-service');

// Read .env if present
const envPath = path.join(__dirname, '../.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  });
}

async function testServices() {
  console.log('=== 1. Testing Google Cloud TTS ===');
  const ttsKey = env.GOOGLE_TTS_API_KEY || env.GEMINI_API_KEY;
  const tts = new GoogleTTSService(ttsKey);
  console.log('GoogleTTSService hasApiKey:', tts.hasApiKey());

  const ttsStart = Date.now();
  try {
    const audioBase64 = await tts.speak('Hello! Pointy is testing text to speech.', 'en-US');
    const ttsDuration = Date.now() - ttsStart;
    if (audioBase64) {
      console.log(`✅ Google TTS SUCCESS in ${ttsDuration}ms! Audio base64 length: ${audioBase64.length} bytes`);
      // Save test mp3 to scratch
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      fs.writeFileSync(path.join(__dirname, 'test-tts-output.mp3'), audioBuffer);
      console.log('Saved test audio to scratch/test-tts-output.mp3');
    } else {
      console.error(`❌ Google TTS returned null/empty audio!`);
    }
  } catch (err) {
    console.error('❌ Google TTS Error:', err.message, err.response?.data || '');
  }

  console.log('\n=== 2. Testing AssemblyAI STT ===');
  const sttKey = env.ASSEMBLYAI_API_KEY;
  const stt = new AssemblyAIService(sttKey);
  console.log('AssemblyAIService hasApiKey:', stt.hasApiKey());

  // Let's create or test with a valid audio buffer.
  // If test-tts-output.mp3 was created, we can send that audio buffer to AssemblyAI to transcribe!
  const audioFilePath = path.join(__dirname, 'test-tts-output.mp3');
  if (fs.existsSync(audioFilePath)) {
    const testBuffer = fs.readFileSync(audioFilePath);
    console.log(`Sending generated audio (${testBuffer.length} bytes) to AssemblyAI...`);
    const sttStart = Date.now();
    try {
      const result = await stt.transcribe(testBuffer);
      const sttDuration = Date.now() - sttStart;
      console.log(`✅ AssemblyAI STT SUCCESS in ${sttDuration}ms!`);
      console.log('Transcribed Text:', JSON.stringify(result.transcript));
      console.log('Detected Language:', result.language);
      console.log('Confidence:', result.confidence);
    } catch (err) {
      console.error('❌ AssemblyAI Error:', err.message, err.response?.data || '');
    }
  } else {
    console.warn('Could not test AssemblyAI because no test audio file was generated.');
  }
}

testServices();
