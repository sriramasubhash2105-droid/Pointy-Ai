const { execSync } = require('child_process');

const ps = `Get-Process | Select-Object Id, ProcessName | ConvertTo-Json -Compress`;
const res = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' });
const procs = JSON.parse(res);
const appleProcs = procs.filter(p => p.ProcessName.toLowerCase().includes('apple'));
console.log('Running Apple processes:', appleProcs);
