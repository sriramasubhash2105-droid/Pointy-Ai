const axios = require('axios');

const apiKey = 'your_easyvoice_api_key_here';
const endpoint = 'https://easyvoice.ae/api/v1/audio/speech';

async function testVoices() {
  for (const voice of ['af_heart', 'af_bella', 'af_aoede']) {
    try {
      const res = await axios.post(
        endpoint,
        {
          model: 'kokoro-82m',
          input: 'Testing ' + voice,
          voice,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          responseType: 'arraybuffer',
          timeout: 8000,
        }
      );
      console.log(`Voice ${voice}: ✅ Success (${res.data.length} bytes)`);
    } catch (err) {
      console.log(`Voice ${voice}: ❌ ${err.message}`);
    }
  }
}

testVoices();
