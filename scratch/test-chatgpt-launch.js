const { exec } = require('child_process');

console.log('Testing launch of ChatGPT desktop app...');

// 1. Test shell:AppsFolder with OpenAI.Codex
exec('start "" "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App"', { shell: 'cmd.exe' }, (err) => {
  console.log('OpenAI.Codex launch result:', err ? err.message : 'OK');
});

// 2. Test shell:AppsFolder with OpenAI.ChatGPT-Desktop
exec('start "" "shell:AppsFolder\\OpenAI.ChatGPT-Desktop_2p2nqsd0c76g0!ChatGPT"', { shell: 'cmd.exe' }, (err) => {
  console.log('OpenAI.ChatGPT-Desktop launch result:', err ? err.message : 'OK');
});
