const { ActionService } = require('../src/main/services/action-service.js');

const service = new ActionService();

const testQueries = [
  "open chatgpt",
  "open chat gpt",
  "chat gpt",
  "chatgpt",
  "open chat gpt app",
  "open chatgpt app",
  "open chat gpt desktop",
  "open openai",
  "open claude",
  "open claude app",
  "open notion",
  "open perplexity",
  "open spotify",
  "open apple music",
  "open apple tv",
  "open music",
  "open tv",
  "open vlc",
  "open capcut",
  "open autocad",
  "open visual studio code",
  "open vs code",
  // In-browser should STILL open in that browser:
  "open chatgpt in brave",
  "open chatgpt in comet",
  "open youtube in brave",
  "open github in comet"
];

console.log('Testing Real ActionService App-First Matching:');
let passed = 0;
for (const q of testQueries) {
  const res = service.matchLocalIntent(q);
  if (res && res.matched) {
    passed++;
    console.log(`✅ "${q}" -> type: ${res.type}, name: "${res.name}", target: "${res.appId || res.target || res.url || ''}"`);
  } else {
    console.log(`❌ "${q}" -> NOT MATCHED`);
  }
}
console.log(`\nResult: ${passed} / ${testQueries.length} passed!`);
