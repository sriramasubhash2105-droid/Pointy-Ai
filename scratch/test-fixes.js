const https = require('https');

function fetchYouTubeVideoId(query) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 2000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        const match = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        if (match) {
          res.destroy();
          resolve(match[1]);
        }
      });
      res.on('end', () => {
        const match = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        resolve(match ? match[1] : null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function matchIntent(query) {
  let clean = query.trim().toLowerCase()
    .replace(/^(can you please|could you please|please|pointy|can you|could you|hey pointy)\s+/i, '')
    .replace(/\s+(please|for me|right now)$/i, '')
    .trim();

  // YouTube play match
  const ytPlayMatch = clean.match(/^play\s+(.+?)\s+(?:from|on|in)\s+youtube$/i) ||
                      clean.match(/^play\s+youtube\s+(?:for\s+)?(.+)$/i);
  if (ytPlayMatch && ytPlayMatch[1]) {
    const song = ytPlayMatch[1].trim();
    return { type: 'youtube_play', query: song, reply: `Playing ${song} on YouTube for you!` };
  }

  const generalPlayMatch = clean.match(/^play\s+(.+)$/i);
  if (generalPlayMatch && generalPlayMatch[1]) {
    const target = generalPlayMatch[1].trim();
    const isSystem = /^(music|song|track|audio|something|it|media)$/i.test(target);
    const isApple = target.includes('apple');
    if (!isSystem && !isApple) {
      return { type: 'youtube_play', query: target, reply: `Playing ${target} on YouTube for you!` };
    }
  }

  // Antigravity IDE vs Antigravity App match
  if (clean.includes('antigravity') && (clean.includes('ide') || clean.includes('code') || clean.includes('editor'))) {
    return { type: 'launch_app', target: 'C:\\Users\\srira\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe', name: 'Antigravity IDE' };
  }

  if (clean.includes('antigravity')) {
    return { type: 'launch_app', target: 'C:\\Users\\srira\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe', name: 'Antigravity' };
  }

  return null;
}

const tests = [
  'play honeypie from youtube',
  'play honeypie on youtube',
  'play honeypie',
  'open antigravity ide',
  'open antigravity',
  'launch antigravity ide',
  'can you open antigravity ide please',
];

async function run() {
  for (const t of tests) {
    const res = matchIntent(t);
    console.log(`Query: "${t}" =>`, res);
    if (res && res.type === 'youtube_play') {
      const vid = await fetchYouTubeVideoId(res.query);
      console.log(`   -> YouTube Direct Play URL: https://www.youtube.com/watch?v=${vid}&autoplay=1`);
    }
  }
}
run();
