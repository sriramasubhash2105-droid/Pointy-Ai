const { exec, execSync } = require('child_process');

function launchAppleMusic() {
  return new Promise((resolve) => {
    exec('powershell -NoProfile -Command "$p=Get-Process -Name AppleMusic -ErrorAction SilentlyContinue; if($p -and $p.MainWindowHandle -eq 0){$p.Kill()}"', () => {
      exec('start music:', { shell: 'cmd.exe' }, (err) => {
        if (err) exec('start AppleMusic.exe', { shell: 'cmd.exe' });
        resolve(true);
      });
    });
  });
}

function launchAppleTV() {
  return new Promise((resolve) => {
    exec('powershell -NoProfile -Command "$p=Get-Process -Name AppleTV -ErrorAction SilentlyContinue; if($p -and $p.MainWindowHandle -eq 0){$p.Kill()}"', () => {
      exec('start AppleTV.exe', { shell: 'cmd.exe' }, (err) => {
        if (err) exec('start videos:', { shell: 'cmd.exe' });
        resolve(true);
      });
    });
  });
}

async function run() {
  console.log('Testing launchAppleMusic...');
  await launchAppleMusic();

  console.log('Testing launchAppleTV...');
  await launchAppleTV();

  setTimeout(() => {
    const out = execSync('powershell -NoProfile -Command "Get-Process -Name AppleMusic, AppleTV -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowHandle, MainWindowTitle | Format-Table -AutoSize"').toString();
    console.log('Final processes status:\n', out);
  }, 4000);
}

run();
