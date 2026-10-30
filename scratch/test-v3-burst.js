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

async function transcribeWithV3Streaming(wavBuffer) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  const url = `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000`;
  const pcmData = wavBuffer.slice(44);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { Authorization: apiKey } });
    let latestTranscript = '';
    const t0 = Date.now();

    ws.on('open', () => {
      console.log(`[V3 WS] Connected in ${Date.now() - t0}ms, streaming audio...`);
      // Send audio in 50ms slices (1600 bytes)
      const chunkSize = 1600;
      let offset = 0;
      const sendNext = () => {
        if (offset >= pcmData.length) {
          console.log(`[V3 WS] Sent all audio in ${Date.now() - t0}ms. Sending Terminate...`);
          ws.send(JSON.stringify({ type: 'Terminate' }));
          return;
        }
        const slice = pcmData.slice(offset, offset + chunkSize);
        offset += chunkSize;
        ws.send(slice);
        setTimeout(sendNext, 20); // burst feed or real-time feed
      };
      sendNext();
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.transcript) {
          latestTranscript = msg.transcript;
          console.log(`[V3 WS] Live transcript: "${latestTranscript}"`);
        }
        if (msg.type === 'Termination' || msg.message_type === 'SessionTerminated') {
          console.log(`[V3 WS] Session Terminated in ${Date.now() - t0}ms! Final: "${latestTranscript}"`);
          ws.close();
          resolve(latestTranscript);
        }
      } catch (_) {}
    });

    ws.on('error', (err) => {
      console.error('[V3 WS] Error:', err.message);
      reject(err);
    });

    ws.on('close', () => {
      resolve(latestTranscript);
    });

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'Terminate' }));
      }
    }, 15000);
  });
}

async function run() {
  const wav = fs.readFileSync(path.join(__dirname, 'speech-sample.wav'));
  const res = await transcribeWithV3Streaming(wav);
  console.log('Result:', res);
}

run();
