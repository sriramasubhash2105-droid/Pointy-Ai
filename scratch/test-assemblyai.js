const { AssemblyAIService } = require('../src/main/services/assemblyai-service');
const fs = require('fs');
const path = require('path');

// Read .env
const envPath = path.join(__dirname, '../.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[trimmed.slice(0, eq).trim()] = v;
    }
  });
}

function createWavBuffer(durationSec = 2, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate a simple 440Hz sine wave tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 10000;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }

  return buffer;
}

async function testAssemblyAI() {
  console.log('--- Testing AssemblyAI API key and transcription ---');
  const service = new AssemblyAIService(env.ASSEMBLYAI_API_KEY);
  console.log('hasApiKey:', service.hasApiKey());

  const wav = createWavBuffer(2);
  console.log('Generated WAV buffer size:', wav.length, 'bytes');

  try {
    const start = Date.now();
    const res = await service.transcribe(wav);
    console.log(`✅ AssemblyAI responded in ${Date.now() - start}ms:`, res);
  } catch (err) {
    console.error('❌ AssemblyAI transcribe error:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status, err.response.data);
    }
  }
}

testAssemblyAI();
