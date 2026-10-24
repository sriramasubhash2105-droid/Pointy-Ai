const screenshot = require('screenshot-desktop');
const fs = require('fs');

async function capture() {
  const img = await screenshot({ format: 'png' });
  fs.writeFileSync('scratch/live-idle-verify.png', img);
  console.log('Captured screenshot to scratch/live-idle-verify.png, size:', img.length);
}

capture().catch(console.error);
