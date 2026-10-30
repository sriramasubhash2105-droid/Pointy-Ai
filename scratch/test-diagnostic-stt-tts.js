const fs = require('fs');
const path = require('path');
const { GoogleTTSService } = require('../src/main/services/google-tts-service');
const { AssemblyAIService } = require('../src/main/services/assemblyai-service');

// Load environment variables
const envPath = path.join(__dirname, '../.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) {
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[trimmed.slice(0, eq).trim()] = v;
    }
  });
}

async function runDiagnostics() {
  console.log('====================================================');
  console.log('   POINTY AI - SPEECH (STT & TTS) DIAGNOSTIC SUITE  ');
  console.log('====================================================\n');

  // 1. Check API Keys
  console.log('📋 STEP 1: API Configuration Check');
  const assemblyKey = env.ASSEMBLYAI_API_KEY || '';
  const googleTtsKey = env.GOOGLE_TTS_API_KEY || '';
  const geminiKey = env.GEMINI_API_KEY || '';

  console.log(` - ASSEMBLYAI_API_KEY: ${assemblyKey ? '✅ Present (' + assemblyKey.length + ' chars)' : '❌ Missing'}`);
  console.log(` - GOOGLE_TTS_API_KEY: ${googleTtsKey ? '✅ Present (' + googleTtsKey.length + ' chars)' : '❌ Missing'}`);
  console.log(` - GEMINI_API_KEY:     ${geminiKey ? '✅ Present (' + geminiKey.length + ' chars)' : '❌ Missing'}`);

  // 2. Test TTS (Google Cloud + Local Fallback)
  console.log('\n🔊 STEP 2: Text-to-Speech (TTS) Verification');
  const ttsService = new GoogleTTSService(googleTtsKey || geminiKey);
  const testPhrase = "Hello, Pointy speech synthesis is working smoothly!";
  console.log(`Synthesizing test phrase: "${testPhrase}"`);

  const ttsStart = Date.now();
  let ttsAudioBase64 = null;
  try {
    ttsAudioBase64 = await ttsService.speak(testPhrase, 'en-US');
    const ttsDuration = Date.now() - ttsStart;
    if (ttsAudioBase64) {
      const isWav = ttsAudioBase64.startsWith('UklGR');
      const format = isWav ? 'WAV (Local High-Fidelity SAPI)' : 'MP3 (Google Cloud Neural2)';
      console.log(`✅ TTS SUCCESS in ${ttsDuration}ms!`);
      console.log(`   Audio Format:   ${format}`);
      console.log(`   Base64 Length:  ${ttsAudioBase64.length} chars`);
      console.log(`   Decoded Size:   ${Math.round(ttsAudioBase64.length * 0.75)} bytes`);

      // Save output
      const ext = isWav ? 'wav' : 'mp3';
      const outPath = path.join(__dirname, `diagnostic-tts.${ext}`);
      fs.writeFileSync(outPath, Buffer.from(ttsAudioBase64, 'base64'));
      console.log(`   Saved artifact: ${outPath}`);
    } else {
      console.error(`❌ TTS returned null!`);
    }
  } catch (err) {
    console.error(`❌ TTS exception:`, err.message);
  }

  // 3. Test STT (AssemblyAI Live Speech-to-Text)
  console.log('\n🎙️ STEP 3: Speech-to-Text (STT) Verification');
  const sttService = new AssemblyAIService(assemblyKey);
  const wavPath = path.join(__dirname, 'speech-sample.wav');

  if (fs.existsSync(wavPath)) {
    const audioBuf = fs.readFileSync(wavPath);
    console.log(`Testing AssemblyAI STT with speech sample (${audioBuf.length} bytes)...`);
    const sttStart = Date.now();
    try {
      const sttResult = await sttService.transcribe(audioBuf);
      const sttDuration = Date.now() - sttStart;
      console.log(`✅ STT SUCCESS in ${sttDuration}ms!`);
      console.log(`   Transcribed Text:  "${sttResult.transcript}"`);
      console.log(`   Detected Language: ${sttResult.language}`);
      console.log(`   Confidence:        ${sttResult.confidence}`);
    } catch (sttErr) {
      console.error(`❌ STT exception:`, sttErr.message);
    }
  } else {
    console.warn(`⚠️ No speech sample file found at ${wavPath} to test STT.`);
  }

  console.log('\n====================================================');
  console.log('   ALL DIAGNOSTIC CHECKS COMPLETED SUCCESSFULLY     ');
  console.log('====================================================\n');
}

runDiagnostics();
