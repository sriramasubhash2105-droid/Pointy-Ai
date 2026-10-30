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

async function testStreaming() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  console.log('Testing AssemblyAI Real-Time WebSocket with key:', apiKey?.slice(0, 8) + '...');

  const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`;
  const ws = new WebSocket(url, {
    headers: {
      Authorization: apiKey,
    },
  });

  ws.on('open', () => {
    console.log('✅ WebSocket Connected!');
    // Read speech-sample.wav
    const wav = fs.readFileSync(path.join(__dirname, 'speech-sample.wav'));
    // Strip 44-byte WAV header to get pure PCM 16-bit 16kHz
    const pcmData = wav.slice(44);
    console.log(`Sending ${pcmData.length} bytes of raw PCM audio in chunks...`);

    const chunkSize = 3200; // 100ms at 16000Hz 16-bit mono
    let offset = 0;
    const interval = setInterval(() => {
      if (offset >= pcmData.length) {
        clearInterval(interval);
        console.log('Done sending audio chunks, sending terminate message...');
        ws.send(JSON.stringify({ terminate_session: true }));
        return;
      }
      const chunk = pcmData.slice(offset, offset + chunkSize);
      offset += chunkSize;
      const base64 = chunk.toString('base64');
      ws.send(JSON.stringify({ audio_data: base64 }));
    }, 100);
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.message_type === 'SessionBegins') {
      console.log('SessionBegins:', msg.session_id);
    } else if (msg.message_type === 'PartialTranscript') {
      if (msg.text) console.log('Partial:', msg.text);
    } else if (msg.message_type === 'FinalTranscript') {
      console.log('🎯 Final Transcript:', msg.text);
    } else if (msg.message_type === 'SessionTerminated') {
      console.log('SessionTerminated');
      ws.close();
    } else {
      console.log('WS Message:', msg);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: code=${code}, reason=${reason}`);
  });
}

testStreaming();
