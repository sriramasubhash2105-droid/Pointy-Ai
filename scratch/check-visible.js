const { PNG } = require('pngjs');
const fs = require('fs');

const data = fs.readFileSync('C:/Users/srira/.gemini/antigravity-ide/brain/7b528159-4c15-4705-be85-33dd7925469b/scratch/debug-overlay.png');
const png = PNG.sync.read(data);

console.log('Image dimensions:', png.width, 'x', png.height);

let minX = png.width, minY = png.height, maxX = 0, maxY = 0;
let visibleCount = 0;

for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const idx = (png.width * y + x) << 2;
    const a = png.data[idx + 3];
    if (a > 10) {
      visibleCount++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

console.log('Visible pixel count:', visibleCount);
console.log('Bounding box:', { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 });
