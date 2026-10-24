Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Host "Primary bounds: $($b.Width) x $($b.Height)"
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$savePath = 'scratch\ps-screen.jpg'
$bmp.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose()
$bmp.Dispose()

$fileInfo = Get-Item $savePath
Write-Host "Captured bytes: $($fileInfo.Length)"
