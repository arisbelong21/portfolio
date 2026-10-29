param(
  [string]$Source = "preview/hero-00-15.png",
  [string]$Out = "public/og-image.jpg"
)

# OG image 1200x630 dari frame scene-only 1440x900.
# Crop diambil dengan rasio yang sama (1440x756) lalu diperkecil seragam,
# jadi planetnya tidak gepeng.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source).Path)
if ($src.Width -ne 1440 -or $src.Height -ne 900) { throw "butuh frame 1440x900, dapat $($src.Width)x$($src.Height)" }

$cropY = 72
$bmp = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$dest = New-Object System.Drawing.Rectangle 0, 0, 1200, 630
$srcRect = New-Object System.Drawing.Rectangle 0, $cropY, 1440, 756
$g.DrawImage($src, $dest, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

# scrim kiri-bawah supaya teks terbaca di atas planet
$scrim = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point 0, 300),
  (New-Object System.Drawing.Point 0, 630),
  [System.Drawing.Color]::FromArgb(0, 7, 8, 11),
  [System.Drawing.Color]::FromArgb(236, 7, 8, 11)
)
$g.FillRectangle($scrim, 0, 300, 1200, 330)

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(242, 242, 239, 233))
$mint = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 227, 193))
$dim = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(178, 183, 180, 173))
$line = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(95, 148, 227, 193)), 2

$fName = New-Object System.Drawing.Font "Segoe UI Light", 104, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$fSubSmall = New-Object System.Drawing.Font "Consolas", 19, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$fSub = New-Object System.Drawing.Font "Consolas", 23, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)

$g.DrawString("ARIS", $fName, $white, 68, 392)
$g.DrawLine($line, 76, 520, 186, 520)
$g.DrawString("Solo Developer  /  AI Automation", $fSub, $dim, 76, 536)
$g.DrawString("JARVIS  ·  Chopster  ·  Racuninaja", $fSubSmall, $dim, 76, 574)
$g.DrawString("PORTFOLIO  /  $((Get-Date).Year)", $fSub, $mint, 76, 352)

$g.Dispose()

$dir = Split-Path -Parent $Out
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$full = Join-Path (Resolve-Path (Split-Path -Parent $Out)).Path (Split-Path -Leaf $Out)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90L
$bmp.Save($full, $codec, $params)
$bmp.Dispose()
$src.Dispose()

"ok -> $Out ($((Get-Item $Out).Length) bytes)"
