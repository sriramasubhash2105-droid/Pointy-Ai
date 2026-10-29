const { exec } = require('child_process');

console.log('Testing launch from Node via PowerShell Start-Process...');
exec('powershell -Command "Stop-Process -Name AppleMusic -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 200; Start-Process music:"', (err, stdout, stderr) => {
  console.log('Music result:', { err, stdout, stderr });
});

exec('powershell -Command "Stop-Process -Name AppleTV -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 200; Start-Process videos:"', (err, stdout, stderr) => {
  console.log('TV result:', { err, stdout, stderr });
});
