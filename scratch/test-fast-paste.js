const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testFastType(text, pressEnter = false) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const vbsPath = path.join(process.env.TEMP || '.', `test_paste_${Date.now()}.vbs`);
    const vbsContent = [
      'Set w = CreateObject("WScript.Shell")',
      'w.SendKeys "^v"',
      pressEnter ? 'WScript.Sleep 100\r\nw.SendKeys "{ENTER}"' : ''
    ].filter(Boolean).join('\r\n');

    fs.writeFile(vbsPath, vbsContent, (err) => {
      if (err) {
        console.error('write err:', err);
        return resolve(false);
      }
      exec(`wscript "${vbsPath}"`, (wErr) => {
        try { fs.unlinkSync(vbsPath); } catch (_) {}
        console.log(`⚡ Fast paste took: ${Date.now() - t0}ms`);
        resolve(true);
      });
    });
  });
}

testFastType('hello test', false);
