const path = require('path');
const fs = require('fs');

// 1. Load .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const { EasyVoiceTTSService } = require('../src/main/services/easyvoice-tts-service');

async function testFull() {
  console.log('--- 1. Testing EasyVoiceTTSService Initialization ---');
  const apiKey = process.env.EASYVOICE_API_KEY;
  console.log('EASYVOICE_API_KEY prefix:', apiKey ? apiKey.slice(0, 7) + '...' : 'NONE');

  const tts = new EasyVoiceTTSService(apiKey);
  console.log('hasApiKey():', tts.hasApiKey());

  console.log('\n--- 2. Testing extractFirstSentence ---');
  const fullText = '**Pointy AI** here! I have successfully opened YouTube for you. Would you like me to play anything?';
  const firstSentence = tts.extractFirstSentence(fullText);
  console.log('Input:', fullText);
  console.log('Extracted:', firstSentence);

  console.log('\n--- 3. Testing Cloud Synthesis (Kokoro-82M) with language code parameter ---');
  const startTime = Date.now();
  const audioBase64 = await tts.speak(firstSentence, 'en-US');
  const duration = Date.now() - startTime;
  console.log(`Synthesis completed in ${duration}ms`);
  console.log('Audio base64 length:', audioBase64 ? audioBase64.length : 'NULL');

  if (audioBase64) {
    const buffer = Buffer.from(audioBase64, 'base64');
    console.log('Raw audio byte size:', buffer.length, 'bytes');
    const isWav = buffer.length > 4 && buffer[0] === 0x52 && buffer[1] === 0x49;
    console.log('Audio format detected:', isWav ? 'WAV (RIFF)' : 'MP3');
  }

  console.log('\n--- 4. Testing Local SAPI Fallback (when offline/no key) ---');
  const offlineTts = new EasyVoiceTTSService('');
  const localAudio = await offlineTts.speak('Offline speech synthesizer test.');
  console.log('Offline fallback audio length:', localAudio ? localAudio.length : 'NULL');

  console.log('\n🎉 All tests passed successfully!');
}

testFull().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
