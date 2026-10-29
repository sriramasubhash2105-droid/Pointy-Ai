const { ActionService } = require('../src/main/services/action-service.js');

const service = new ActionService();

async function testExecute() {
  console.log('Testing execute for Apple Music...');
  const a1 = service.matchLocalIntent('open apple music');
  console.log('Matched a1:', a1);
  const r1 = await service.execute(a1);
  console.log('Executed a1:', r1);

  console.log('\nTesting execute for Apple TV...');
  const a2 = service.matchLocalIntent('open apple tv');
  console.log('Matched a2:', a2);
  const r2 = await service.execute(a2);
  console.log('Executed a2:', r2);
}

testExecute();
