const { ActionService } = require('../src/main/services/action-service');

async function test() {
  const service = new ActionService();

  console.log('Testing execution of Apple Music action:');
  const actionMusic = service.matchLocalIntent('open apple music');
  console.log('Action Music:', actionMusic);
  await service.execute(actionMusic);

  console.log('Testing execution of Apple TV action:');
  const actionTv = service.matchLocalIntent('open apple tv');
  console.log('Action TV:', actionTv);
  await service.execute(actionTv);

  console.log('Done execute calls.');
}

test();
