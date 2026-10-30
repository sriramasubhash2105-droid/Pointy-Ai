const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

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

async function testStreamingV3() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  console.log('Testing AssemblyAI v3 Real-Time WebSocket with key:', apiKey?.slice(0, 8) + '...');

  const url = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000`;
  const ws = new WebSocket(url, {
    headers: {
      Authorization: apiKey,
    },
  });

  const t0 = Date.now();

  ws.on('open', () => {
    console.log(`✅ WebSocket Connected in ${Date.now() - t0}ms!`);
    const wav = fs.readFileSync(path.join(__dirname, 'speech-sample.wav'));
    const pcmData = wav.slice(44); // 16kHz 16bit mono PCM
    console.log(`Sending ${pcmData.length} bytes of raw PCM audio...`);

    const chunkSize = 1600; // 50ms chunks
    let offset = 0;
    const interval = setInterval(() => {
      if (offset >= pcmData.length) {
        clearInterval(interval);
        console.log(`Finished sending audio in ${Date.now() - t0}ms, terminating session...`);
        ws.send(JSON.stringify({ terminate_session: true }));
        return;
      }
      const chunk = pcmData.slice(offset, offset + chunkSize);
      offset += chunkSize;
      // In v3, audio data can be sent as raw binary frame!
      ws.send(chunk);
    }, 40);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('WS Msg:', msg);
    } catch (_) {
      console.log('Binary WS Msg:', data.length);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: code=${code}, reason=${reason}`);
  });
}

testStreamingV3();
