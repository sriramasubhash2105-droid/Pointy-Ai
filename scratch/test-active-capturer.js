const { app, desktopCapturer, screen } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  try {
    const p = screen.getPrimaryDisplay();
    console.log('Testing desktopCapturer now at active desktop...');
    console.log('Primary bounds:', p.bounds, 'scale:', p.scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(p.bounds.width * p.scaleFactor),
        height: Math.round(p.bounds.height * p.scaleFactor),
      },
    });

    console.log('Sources found:', sources.length);
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      console.log(`Source ${i}: name="${s.name}", id="${s.id}"`);
      const jpeg = s.thumbnail.toJPEG(85);
      console.log(`Thumbnail JPEG size: ${jpeg.length} bytes`);
      fs.writeFileSync(`scratch/desktop-capturer-${i}.jpg`, jpeg);
    }
  } catch (err) {
    console.error('desktopCapturer error:', err);
  } finally {
    app.quit();
  }
});
