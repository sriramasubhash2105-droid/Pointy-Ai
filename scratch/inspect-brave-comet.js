const { execSync } = require('child_process');
const appdata = process.env.APPDATA.replace(/\\/g, '\\\\');
const cmd = `powershell -NoProfile -Command "$s = New-Object -ComObject WScript.Shell; Get-ChildItem -Path '${appdata}\\Microsoft\\Windows\\Start Menu\\Programs' -Filter *.lnk -Recurse | Where-Object { $_.Name -match 'brave|comet' } | ForEach-Object { Write-Host $_.Name '-> Target:' $s.CreateShortcut($_.FullName).TargetPath 'Arguments:' $s.CreateShortcut($_.FullName).Arguments }"`;
console.log(execSync(cmd, { encoding: 'utf8' }));
