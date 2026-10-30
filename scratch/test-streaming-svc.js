const fs = require('fs');
const path = require('path');
const { AssemblyAIStreamingService } = require('./assemblyai-streaming');

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

async function testService() {
  const svc = new AssemblyAIStreamingService(process.env.ASSEMBLYAI_API_KEY);
  const wav = fs.readFileSync(path.join(__dirname, 'speech-sample.wav'));
  const pcm = wav.slice(44);

  const t0 = Date.now();
  await svc.startSession((transcript) => {
    console.log(`[Stream update ${Date.now() - t0}ms]: "${transcript}"`);
  });

  // Stream in 100ms chunks (3200 bytes)
  const chunkSize = 3200;
  let offset = 0;
  while (offset < pcm.length) {
    const chunk = pcm.slice(offset, offset + chunkSize);
    svc.sendAudioChunk(chunk);
    offset += chunkSize;
    await new Promise((r) => setTimeout(r, 60));
  }

  const tStop = Date.now();
  console.log('Stopping session...');
  const finalTranscript = await svc.stopSession();
  console.log(`Final Result in ${Date.now() - tStop}ms after stopping: "${finalTranscript}"`);
}

testService();
