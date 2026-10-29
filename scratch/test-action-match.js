const { ActionService } = require('../src/main/services/action-service');
const act = new ActionService();

const testQueries = [
  'open notepad',
  'can you open notepad please',
  'launch notepad',
  'open youtube',
  'open youtube for me',
  'search youtube for lofi beats',
  'search google for electron desktop app tutorial',
  'open calculator',
  'open calc',
  'open vs code',
  'open github',
  'open github.com',
  'open chatgpt',
  'open downloads',
  'open settings'
];

let allPassed = true;
for (const q of testQueries) {
  const res = act.matchLocalIntent(q);
  if (!res) {
    console.error(`FAILED: "${q}" did not match!`);
    allPassed = false;
  } else {
    console.log(`PASS: "${q}" -> [${res.type}] ${res.name || res.target} (${res.reply})`);
  }
}

if (allPassed) {
  console.log('\nAll 15 test intents matched successfully!');
} else {
  process.exit(1);
}
