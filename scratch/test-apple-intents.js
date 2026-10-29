const { ActionService } = require('../src/main/services/action-service.js');

const service = new ActionService();

const queries = [
  "open apple music",
  "open apple tv",
  "apple music",
  "apple tv",
  "open apple music app",
  "open apple tv app",
  "launch apple music",
  "launch apple tv",
  "play music from apple music",
  "play music on apple music",
  "play apple music",
  "play music in apple music",
  "play something on apple music",
  "open music",
  "play apple tv",
  "open tv",
  "play movie on apple tv",
  "can you open apple music",
  "can you please open apple tv",
  "hey pointy open apple music",
  "pointy open apple tv"
];

console.log('Testing Apple Music & Apple TV Queries:');
for (const q of queries) {
  const res = service.matchLocalIntent(q);
  console.log(`\n"${q}"`);
  if (res) {
    console.log(`  -> type: ${res.type}, name: "${res.name}", target/appId: "${res.appId || res.target || res.appTarget || ''}"`);
  } else {
    console.log(`  ❌ NOT MATCHED`);
  }
}
