const { exec } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read real key
const envPath = path.join(__dirname, '../.env');
let apiKey = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('GOOGLE_TTS_API_KEY=')) {
      apiKey = line.trim().split('=')[1].replace(/['"]/g, '').trim();
    }
  }
}

class TestTTSService {
  constructor(apiKey) {
    this.apiKey = (apiKey || '').trim();
    this.endpoint = 'https://texttospeech.googleapis.com/v1/text:synthesize';
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 5;
  }

  synthesizeLocal(text) {
    return new Promise((resolve) => {
      try {
        const cleanText = text.replace(/[*_#`~\[\]]/g, '').slice(0, 150);
        const escaped = cleanText.replace(/"/g, '`"');
        const psScript = `
Add-Type -AssemblyName System.Speech;
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female);
$ms = New-Object System.IO.MemoryStream;
$s.SetOutputToWaveStream($ms);
$s.Speak("${escaped}");
$bytes = $ms.ToArray();
$s.Dispose();
$ms.Dispose();
[Convert]::ToBase64String($bytes);
`;
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
        exec(`powershell -NoProfile -EncodedCommand ${encoded}`, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout) => {
          if (err || !stdout) {
            resolve(null);
          } else {
            console.log('[TestTTS] 🎙️ Local Windows Speech Synthesizer fallback generated audio');
            resolve(stdout.trim());
          }
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  async speak(text, languageCode = 'en-US') {
    if (!text) return null;

    if (this.hasApiKey()) {
      try {
        console.log(`[TestTTS] Attempting Cloud TTS: "${text.slice(0, 40)}..."`);
        const res = await axios.post(`${this.endpoint}?key=${this.apiKey}`, {
          input: { text },
          voice: { languageCode, name: 'en-US-Neural2-F' },
          audioConfig: { audioEncoding: 'MP3' }
        }, { timeout: 3000 });
        if (res.data?.audioContent) return res.data.audioContent;
      } catch (err) {
        console.warn('[TestTTS] Cloud TTS error, seamlessly switching to local synthesis:', err.response?.data?.error?.message || err.message);
      }
    }

    return await this.synthesizeLocal(text);
  }
}

async function run() {
  const tts = new TestTTSService(apiKey);
  const start = Date.now();
  const audio = await tts.speak("Pointy is ready to assist you!");
  console.log(`Result: Audio length = ${audio?.length || 0} in ${Date.now() - start}ms`);
}

run();
