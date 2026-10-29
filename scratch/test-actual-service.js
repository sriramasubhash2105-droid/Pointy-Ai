const { ActionService } = require('../src/main/services/action-service');
const act = new ActionService();

const tests = [
  'play honeypie from youtube',
  'play honeypie on youtube',
  'play honeypie',
  'open antigravity ide',
  'launch antigravity ide',
  'open antigravity',
  'open claude',
  'open calender in the chrome from student account',
  'play music from apple music'
];

async function run() {
  for (const t of tests) {
    const res = act.matchLocalIntent(t);
    if (!res) {
      console.error(`FAILED: "${t}"`);
    } else {
      console.log(`[PASS] "${t}" -> Type: ${res.type} | Name: ${res.name} | Target: ${res.target || res.query || res.appTarget}`);
    }
  }
}
run();
