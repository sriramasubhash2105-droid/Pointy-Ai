const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const braveLnk = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Brave.lnk');
const cometLnk = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Comet.lnk');

console.log('Brave LNK exists:', fs.existsSync(braveLnk));
console.log('Comet LNK exists:', fs.existsSync(cometLnk));

const braveExe = path.join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
const cometExe = path.join(process.env.LOCALAPPDATA, 'Perplexity', 'Comet', 'Application', 'comet.exe');

console.log('Brave Exe exists:', fs.existsSync(braveExe));
console.log('Comet Exe exists:', fs.existsSync(cometExe));
