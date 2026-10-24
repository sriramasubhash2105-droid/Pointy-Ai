const fs = require('fs');
const path = require('path');

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

const { AssemblyAIService } = require('../src/main/services/assemblyai-service');

async function testAssemblyTranscribe() {
  const svc = new AssemblyAIService(process.env.ASSEMBLYAI_API_KEY);
  console.log('Testing AssemblyAI service with 1-second dummy audio buffer...');

  // Create a 1-second silent WAV
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = sampleRate * numChannels * (bitsPerSample / 8) * 1.0;
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

  try {
    const res = await svc.transcribe(buffer);
    console.log('AssemblyAI Result:', res);
  } catch (e) {
    console.error('AssemblyAI Error:', e.message);
  }
}

testAssemblyTranscribe();
