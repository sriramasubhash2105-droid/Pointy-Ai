const { execSync } = require('child_process');
const appdata = process.env.APPDATA.replace(/\\/g, '\\\\');
const cmd = `powershell -NoProfile -Command "$s = New-Object -ComObject WScript.Shell; Get-ChildItem -Path '${appdata}\\Microsoft\\Windows\\Start Menu\\Programs' -Filter *antigravity*.lnk -Recurse | ForEach-Object { Write-Host $_.Name '->' $s.CreateShortcut($_.FullName).TargetPath }"`;
console.log(execSync(cmd, { encoding: 'utf8' }));
