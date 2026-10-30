const axios = require('axios');
const fs = require('fs');
const path = require('path');

const apiKey = 'your_easyvoice_api_key_here';
const endpoint = 'https://easyvoice.ae/api/v1/audio/speech';

async function testEasyVoice() {
  console.log('--- Testing EasyVoice TTS API ---');
  console.log('Endpoint:', endpoint);
  console.log('API Key:', apiKey.slice(0, 10) + '...' + apiKey.slice(-6));

  const start = Date.now();
  try {
    const res = await axios.post(
      endpoint,
      {
        model: 'kokoro-82m',
        input: 'Hello, Pointy AI is now powered by EasyVoice text to speech!',
        voice: 'af_aoede',
        response_format: 'mp3',
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 10000,
      }
    );

    const duration = Date.now() - start;
    console.log(`✅ Success in ${duration}ms!`);
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Data length:', res.data.length, 'bytes');

    const outPath = path.join(__dirname, 'test-easyvoice-output.mp3');
    fs.writeFileSync(outPath, Buffer.from(res.data));
    console.log('Saved audio to:', outPath);

    const base64 = Buffer.from(res.data).toString('base64');
    console.log('Base64 length:', base64.length);
  } catch (err) {
    console.error('❌ EasyVoice error:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      try {
        const text = Buffer.from(err.response.data).toString('utf8');
        console.error('Response body:', text);
      } catch (_) {}
    }
  }
}

testEasyVoice();
