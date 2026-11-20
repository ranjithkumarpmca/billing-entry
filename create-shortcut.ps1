# Run once. Makes app.ico from frontend\public\logo.png and puts a "Billing Entry" shortcut on the Desktop.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$png  = Join-Path $root 'frontend\public\logo.png'
$ico  = Join-Path $root 'app.ico'
$bat  = Join-Path $root 'start-billing.bat'

if (-not (Test-Path $png)) { Write-Host "logo.png not found: $png"; Read-Host 'Press Enter to close'; exit 1 }

Add-Type -AssemblyName System.Drawing
# 256x256 PNG, wrapped in an .ico container (Windows accepts PNG inside ICO).
$src = [System.Drawing.Image]::FromFile($png)
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($src, 0, 0, 256, 256)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
$pngBytes = $ms.ToArray()

$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter($out)
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)
$w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0)
$w.Write([uint16]1); $w.Write([uint16]32)
$w.Write([uint32]$pngBytes.Length); $w.Write([uint32]22)
$w.Write($pngBytes)
$w.Flush()
[System.IO.File]::WriteAllBytes($ico, $out.ToArray())

$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut((Join-Path $desktop 'Billing Entry.lnk'))
$s.TargetPath = $bat
$s.WorkingDirectory = $root
$s.IconLocation = "$ico,0"
$s.Description = 'Billing Entry - Franch Express Courier'
$s.Save()
Write-Host "Done. Shortcut created on the Desktop."
Read-Host 'Press Enter to close'
