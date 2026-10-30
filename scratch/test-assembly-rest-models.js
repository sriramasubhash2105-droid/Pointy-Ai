const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

async function testModels() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  const audioBuffer = fs.readFileSync(path.join(__dirname, 'speech-sample.wav'));

  console.log('Uploading sample...');
  const up = await axios.post('https://api.assemblyai.com/v2/upload', audioBuffer, {
    headers: { authorization: apiKey, 'Content-Type': 'application/octet-stream' }
  });
  const audio_url = up.data.upload_url;
  console.log('Uploaded to:', audio_url);

  const configs = [
    { speech_models: ['universal-2'] },
    { speech_models: ['universal-3-5-pro'] }
  ];

  for (const cfg of configs) {
    const t0 = Date.now();
    try {
      const postRes = await axios.post('https://api.assemblyai.com/v2/transcript', {
        audio_url,
        ...cfg
      }, {
        headers: { authorization: apiKey, 'Content-Type': 'application/json' }
      });
      const id = postRes.data.id;
      console.log(`Submitted ${JSON.stringify(cfg)} -> id: ${id}`);
      while (Date.now() - t0 < 30000) {
        await new Promise(r => setTimeout(r, 400));
        const poll = await axios.get(`https://api.assemblyai.com/v2/transcript/${id}`, {
          headers: { authorization: apiKey }
        });
        if (poll.data.status === 'completed') {
          console.log(`✅ [${JSON.stringify(cfg)}] finished in ${Date.now() - t0}ms: "${poll.data.text}"`);
          break;
        } else if (poll.data.status === 'error') {
          console.log(`❌ [${JSON.stringify(cfg)}] Error: ${poll.data.error}`);
          break;
        }
      }
    } catch (e) {
      console.error('Error with cfg:', e.response?.data || e.message);
    }
  }
}

testModels();
