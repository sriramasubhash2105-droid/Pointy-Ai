const fs = require('fs');
const file = 'src/main/services/gemini-service.js';
let content = fs.readFileSync(file, 'utf8');

const target1 = `* Apple Music: "shell:AppsFolder\\\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App".`;
const rep1 = `* Apple Music: type="apple_app", name="Apple Music", protocol="music:".`;

const target2 = `* Apple TV: "shell:AppsFolder\\\\AppleInc.AppleTVWin_nzyj5cx40ttqa!App".`;
const rep2 = `* Apple TV: type="apple_app", name="Apple TV", protocol="videos:".`;

if (content.includes(target1)) {
  content = content.replace(target1, rep1);
  console.log('Replaced target 1');
} else {
  console.log('Target 1 not found');
}

if (content.includes(target2)) {
  content = content.replace(target2, rep2);
  console.log('Replaced target 2');
} else {
  console.log('Target 2 not found');
}

fs.writeFileSync(file, content, 'utf8');
console.log('Saved successfully');
