const { exec } = require('child_process');

function launchAppId(appId) {
  return new Promise((resolve) => {
    // Method 1: powershell Start-Process shell:AppsFolder\<AppID>
    const psCmd = `powershell -WindowStyle Hidden -NoProfile -Command "Start-Process 'shell:AppsFolder\\${appId}'"`;
    exec(psCmd, (err) => {
      if (err) {
        console.error('PS error for ' + appId + ':', err.message);
        // Fallback: explorer.exe
        exec(`explorer.exe shell:AppsFolder\\${appId}`, (err2) => {
          resolve(!err2);
        });
      } else {
        console.log('Successfully launched via PS Start-Process: ' + appId);
        resolve(true);
      }
    });
  });
}

console.log('Testing launchAppId...');
launchAppId('Comet.FH2PZEZMTZJQAQJMHT3SSFWNEU').then(ok => console.log('Comet result:', ok));
