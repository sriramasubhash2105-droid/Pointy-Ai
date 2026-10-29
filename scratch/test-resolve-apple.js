const { ActionService } = require('../src/main/services/action-service');

async function test() {
  const service = new ActionService();

  const queries = [
    'open apple music',
    'apple music',
    'open music',
    'play apple music',
    'play honeypie on apple music',
    'open apple tv',
    'apple tv',
    'open tv',
    'play apple tv',
    'watch apple tv',
    'open chatgpt',
    'open claude'
  ];

  for (const q of queries) {
    const res = service.matchLocalIntent(q);
    console.log(`Query: "${q}" => matched: ${res?.matched}, type: ${res?.type}, name: ${res?.name}, appId: ${res?.appId}, protocol: ${res?.protocol}`);
  }
}

test();
