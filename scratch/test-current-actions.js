const { ActionService } = require('../src/main/services/action-service.js');

const service = new ActionService();

const testQueries = [
  // 1. Brave & Comet launching
  "open brave",
  "open comet",
  "open brave browser",
  "open comet browser",

  // 2. In-browser websites
  "open youtube in brave",
  "open youtube in comet",
  "open github in brave",
  "open github in comet",
  "open calendar in brave",
  "open calendar in comet",

  // 3. Media playback in specific browser or apps
  "play honeypie in brave",
  "play honeypie in comet",
  "play honeypie from youtube in brave",
  "play honeypie on spotify",
  "play blinding lights on apple music",

  // 4. Searches in Brave & Comet
  "search react tutorials in brave",
  "search latest news in comet",
  "ask comet how far is Mars",
  "search quantum computing on brave",

  // 5. Profiles in Brave & Comet
  "open brave from work account",
  "open brave from student account",
  "open calendar in brave from work profile",

  // 6. Other installed apps
  "open capcut",
  "open notion",
  "open perplexity",
  "open lm studio",
  "open kimi",
  "open vlc",
  "open whatsapp",
  "open autocad",
  "open visual studio code",
  "open antigravity ide",
  "open antigravity"
];

console.log('Testing queries against current ActionService:');
for (const q of testQueries) {
  const res = service.matchLocalIntent(q);
  console.log(`\nQuery: "${q}"`);
  if (res) {
    console.log(`  -> Matched: type=${res.type}, name="${res.name || ''}", target="${res.target || res.url || res.appId || ''}", browser="${res.browser || ''}"`);
  } else {
    console.log(`  ❌ NOT MATCHED`);
  }
}
