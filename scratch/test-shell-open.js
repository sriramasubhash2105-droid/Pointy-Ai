const { exec } = require('child_process');

console.log('Testing AppActivationManager / Shell.Application...');

// In Windows Scripting Host, Shell.Application has a method:
// (New-Object -ComObject Shell.Application).Open("shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App")
// OR
// $app = (New-Object -ComObject Shell.Application).NameSpace('shell:AppsFolder').Items() | Where-Object { $_.Name -eq 'Apple Music' }
// $app.InvokeVerb('open')

const testScript = `
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace('shell:AppsFolder')
$item = $folder.Items() | Where-Object { $_.Path -like '*AppleMusicWin*' -or $_.Name -like '*Apple Music*' } | Select-Object -First 1
if ($item) {
  Write-Host "Found item: $($item.Name) -> $($item.Path)"
  $item.InvokeVerb('open')
  Write-Host "Invoked open successfully!"
} else {
  Write-Host "Item not found!"
}
`;

exec(`powershell -NoProfile -Command "${testScript.replace(/\r?\n/g, '; ')}"`, (err, stdout, stderr) => {
  console.log('Shell.Application result:');
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
});
