$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root "assets\sprites\ayu-sprites-v19-redrawn-walk-cat-end.png"
$referencePath = Join-Path $root "assets\sprites\ayu-sprites-v18-alternating-walk-cat-transition.png"
$destinationPath = Join-Path $root "assets\sprites\ayu-sprites-v20-transform-cat-scale-fixed.png"
$frameSize = 147
$column = 7
$row = 5
$cell = New-Object System.Drawing.Rectangle -ArgumentList ($column * $frameSize), ($row * $frameSize), $frameSize, $frameSize

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
$reference = [System.Drawing.Bitmap]::FromFile($referencePath)
try {
    if ($source.Width -ne 1176 -or $source.Height -ne 1176) {
        throw "Unexpected Ayu source sheet size: $($source.Width)x$($source.Height)"
    }
    if ($reference.Width -ne 1176 -or $reference.Height -ne 1176) {
        throw "Unexpected Ayu reference sheet size: $($reference.Width)x$($reference.Height)"
    }

    $output = New-Object System.Drawing.Bitmap -ArgumentList $source.Width, $source.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($output)
        try {
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.DrawImageUnscaled($source, 0, 0)
            $graphics.DrawImage($reference, $cell, $cell, [System.Drawing.GraphicsUnit]::Pixel)
        }
        finally {
            $graphics.Dispose()
        }
        $output.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $output.Dispose()
    }
}
finally {
    $reference.Dispose()
    $source.Dispose()
}

Write-Output $destinationPath
