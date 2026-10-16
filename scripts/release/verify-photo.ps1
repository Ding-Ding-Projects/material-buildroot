param([Parameter(Mandatory=$true)][string]$PhotoPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($PhotoPath)
try {
  # Render every pixel, rather than accepting only a recognizable file header.
  $decoded = New-Object System.Drawing.Bitmap($image.Width, $image.Height)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($decoded)
    try { $graphics.DrawImage($image, 0, 0, $image.Width, $image.Height) }
    finally { $graphics.Dispose() }
    @{width=$image.Width;height=$image.Height} | ConvertTo-Json -Compress
  } finally { $decoded.Dispose() }
} finally { $image.Dispose() }
