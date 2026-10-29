const { execSync } = require('child_process');

try {
  const raw = execSync('powershell -NoProfile -Command "Get-StartApps | ConvertTo-Json -Compress"', { encoding: 'utf8' });
  const list = JSON.parse(raw);
  const apple = list.filter(item => item.Name.toLowerCase().includes('apple') || item.AppID.toLowerCase().includes('apple'));
  console.log('Apple Apps Found in StartApps:', JSON.stringify(apple, null, 2));

  const media = list.filter(item => item.Name.toLowerCase().includes('music') || item.Name.toLowerCase().includes('tv'));
  console.log('Music/TV Apps Found:', JSON.stringify(media, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
