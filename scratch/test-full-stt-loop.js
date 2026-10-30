const { AssemblyAIService } = require('../src/main/services/assemblyai-service');
const fs = require('fs');
const path = require('path');

const spokenSentence = "open notepad and write hello world";
const wavPath = path.join(__dirname, 'speech-sample.wav');

if (!fs.existsSync(wavPath)) {
  console.error('speech-sample.wav not found!');
  process.exit(1);
}

const wavBuffer = fs.readFileSync(wavPath);
console.log(`Audio file size: ${wavBuffer.length} bytes`);

// Read AssemblyAI key
const envPath = path.join(__dirname, '../.env');
let apiKey = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('ASSEMBLYAI_API_KEY=')) {
      apiKey = line.trim().split('=')[1].replace(/['"]/g, '').trim();
    }
  }
}

async function testSTT() {
  console.log('Submitting speech audio to AssemblyAI...');
  const stt = new AssemblyAIService(apiKey);
  const start = Date.now();
  try {
    const result = await stt.transcribe(wavBuffer);
    console.log(`\n========================================`);
    console.log(`✅ AssemblyAI Transcription Completed in ${Date.now() - start}ms:`);
    console.log(`   Expected Speech:   "${spokenSentence}"`);
    console.log(`   Transcribed Text:  "${result.transcript}"`);
    console.log(`   Detected Language: ${result.language}`);
    console.log(`   Confidence Score:  ${result.confidence}`);
    console.log(`========================================`);
  } catch (err) {
    console.error('❌ AssemblyAI Transcription Error:', err.message);
  }
}

testSTT();
