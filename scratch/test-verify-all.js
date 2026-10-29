const { ActionService } = require('../src/main/services/action-service');

async function testAll() {
  const service = new ActionService();

  const testCases = [
    { query: 'open apple music', expectedType: 'apple_app', expectedName: 'Apple Music' },
    { query: 'apple music', expectedType: 'apple_app', expectedName: 'Apple Music' },
    { query: 'open music', expectedType: 'apple_app', expectedName: 'Apple Music' },
    { query: 'play blinding lights on apple music', expectedType: 'apple_music_play' },
    { query: 'open apple tv', expectedType: 'apple_app', expectedName: 'Apple TV' },
    { query: 'apple tv', expectedType: 'apple_app', expectedName: 'Apple TV' },
    { query: 'open tv', expectedType: 'apple_app', expectedName: 'Apple TV' },
    { query: 'open chatgpt', expectedType: 'windows_app_id', expectedName: 'ChatGPT' },
    { query: 'open chat gpt classic', expectedType: 'windows_app_id', expectedName: 'ChatGPT Classic' },
    { query: 'open claude', expectedType: 'windows_app_id', expectedName: 'Claude' },
    { query: 'open youtube in brave', expectedType: 'open_in_browser' },
    { query: 'open youtube in comet', expectedType: 'open_in_browser' },
    { query: 'play honeypie from youtube', expectedType: 'youtube_play' },
    { query: 'open gmail in chrome from student account', expectedType: 'browser_profile_url' },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const act = service.matchLocalIntent(tc.query);
    const okType = act && act.type === tc.expectedType;
    const okName = !tc.expectedName || (act && act.name && act.name.toLowerCase().includes(tc.expectedName.toLowerCase()));

    if (okType && okName) {
      console.log(`✅ PASS: "${tc.query}" => type: ${act.type}, name: "${act.name}"`);
      passed++;
    } else {
      console.error(`❌ FAIL: "${tc.query}" => got:`, act, `expected type: ${tc.expectedType}`);
    }
  }

  console.log(`\nSummary: ${passed}/${testCases.length} tests passed.`);

  // Test execution of apple actions
  console.log('\n--- Testing execute for Apple Music ---');
  const actMusic = service.matchLocalIntent('open apple music');
  const resMusic = await service.execute(actMusic);
  console.log('Execute Apple Music result:', resMusic);

  console.log('\n--- Testing execute for Apple TV ---');
  const actTv = service.matchLocalIntent('open apple tv');
  const resTv = await service.execute(actTv);
  console.log('Execute Apple TV result:', resTv);
}

testAll();
