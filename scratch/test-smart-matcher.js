const fs = require('fs');
const path = require('path');

function getChromeProfiles() {
  const localStatePath = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Local State');
  const profiles = [];
  if (fs.existsSync(localStatePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
      const cache = state.profile?.info_cache || {};
      for (const [dir, info] of Object.entries(cache)) {
        profiles.push({
          dir,
          name: info.name || '',
          email: info.user_name || '',
        });
      }
    } catch (_) {}
  }
  return profiles;
}

const profiles = getChromeProfiles();
console.log('Discovered profiles:', profiles.map(p => `${p.dir} => ${p.name} (${p.email})`));

function matchProfile(text) {
  const lower = text.toLowerCase();
  for (const p of profiles) {
    const pName = p.name.toLowerCase();
    const pEmail = p.email.toLowerCase();
    if (lower.includes('student') || lower.includes('college') || lower.includes('university') || lower.includes('nitw')) {
      if (pName.includes('student') || pEmail.includes('student') || pName.includes('nitw')) {
        return p;
      }
    }
    if (lower.includes('work') || lower.includes('shopzy')) {
      if (pName.includes('work') || pEmail.includes('shopzy')) {
        return p;
      }
    }
    if (lower.includes('personal') || lower.includes('main') || lower.includes('default')) {
      if (p.dir === 'Default' || p.dir === 'Profile 1') {
        return p;
      }
    }
  }
  return null;
}

const testPhrases = [
  'open chrome from my student account',
  'open chrome in student account',
  'open calender in the chrome from student account',
  'open calendar from my student account',
  'open gmail from student account',
  'open chrome from work account',
  'open chrome from personal account',
];

console.log('\n--- TESTING MATCHES ---');
for (const phrase of testPhrases) {
  const prof = matchProfile(phrase);
  console.log(`"${phrase}" => Matched Profile: ${prof ? prof.dir + ' (' + prof.name + ')' : 'NONE'}`);
}
