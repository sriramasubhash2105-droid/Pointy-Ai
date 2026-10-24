const screenshot = require('screenshot-desktop');
const fs = require('fs');

async function testPixelData() {
  console.log('Testing screenshot-desktop capture...');
  const buf = await screenshot({ format: 'png' });
  fs.writeFileSync('scratch/live-shot.png', buf);
  console.log('Saved scratch/live-shot.png, size:', buf.length);

  // Check if there are non-black pixels
  let nonZero = 0;
  for (let i = 54; i < buf.length; i++) {
    if (buf[i] !== 0) nonZero++;
  }
  console.log('Non-zero bytes count in file:', nonZero, 'out of', buf.length);
}

testPixelData();
