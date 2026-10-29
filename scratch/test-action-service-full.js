const { ActionService } = require('../src/main/services/action-service');

async function testFull() {
  const service = new ActionService();

  console.log('--- Testing query matching ---');
  const queries = [
    'open apple music',
    'open apple tv',
    'apple tv',
    'open tv',
    'apple music',
    'play apple music',
    'open chatgpt',
    'open claude'
  ];

  for (const q of queries) {
    const act = service.matchLocalIntent(q);
    console.log(`[MATCH] "${q}" => type: ${act?.type}, name: "${act?.name}", protocol: ${act?.protocol}`);
  }

  console.log('\n--- Testing action execution: Apple Music ---');
  const musicAction = service.matchLocalIntent('open apple music');
  await service.execute(musicAction);

  console.log('\n--- Testing action execution: Apple TV ---');
  const tvAction = service.matchLocalIntent('open apple tv');
  await service.execute(tvAction);

  console.log('\nAll actions dispatched. Waiting 4s to check process windows...');
}

testFull();
