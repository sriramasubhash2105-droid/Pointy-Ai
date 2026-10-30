const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testVbs() {
  const t0 = Date.now();
  const vbsPath = path.join(process.env.TEMP, 'test-paste.vbs');
  fs.writeFileSync(vbsPath, 'Set w = CreateObject("WScript.Shell")\r\nw.SendKeys "^v"\r\n');
  return new Promise((resolve) => {
    exec(`wscript "${vbsPath}"`, () => {
      console.log('wscript SendKeys took:', Date.now() - t0, 'ms');
      resolve();
    });
  });
}

async function testPs() {
  const t0 = Date.now();
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys('^v')"`, () => {
      console.log('powershell SendKeys took:', Date.now() - t0, 'ms');
      resolve();
    });
  });
}

async function run() {
  await testVbs();
  await testPs();
}

run();
