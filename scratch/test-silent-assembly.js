const fs = require('fs');
const axios = require('axios');
const path = require('path');

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

async function testSilentAssembly() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
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

  const up = await axios.post('https://api.assemblyai.com/v2/upload', buffer, {
    headers: { authorization: apiKey, 'Content-Type': 'application/octet-stream' }
  });
  const audio_url = up.data.upload_url;

  const t0 = Date.now();
  const postRes = await axios.post('https://api.assemblyai.com/v2/transcript', {
    audio_url,
    speech_models: ['universal-2']
  }, {
    headers: { authorization: apiKey, 'Content-Type': 'application/json' }
  });
  const id = postRes.data.id;

  while (Date.now() - t0 < 10000) {
    await new Promise(r => setTimeout(r, 300));
    const poll = await axios.get('https://api.assemblyai.com/v2/transcript/' + id, {
      headers: { authorization: apiKey }
    });
    if (poll.data.status === 'completed') {
      console.log(`Silent audio on universal-2 completed in ${Date.now() - t0}ms -> text: "${poll.data.text}"`);
      break;
    }
  }
}

testSilentAssembly();
