const fs = require('fs');
const screenshot = require('screenshot-desktop');

async function checkScreenshot() {
  const buf = await screenshot({ format: 'jpg' });
  fs.writeFileSync('scratch/last-capture.jpg', buf);
  console.log('Saved scratch/last-capture.jpg, size:', buf.length);
}
checkScreenshot();
