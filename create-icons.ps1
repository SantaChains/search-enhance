# PowerShell script to create basic icon files for the extension
Add-Type -AssemblyName System.Drawing

# Create a simple icon drawing function
function Create-Icon {
    param(
        [int]$Size,
        [string]$FilePath
    )
    
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    # Create gradient brush
    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(66, 133, 244), [System.Drawing.Color]::FromArgb(52, 168, 83), [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
    
    # Draw background circle
    $graphics.FillEllipse($brush, 2, 2, $Size-4, $Size-4)
    
    # Draw border
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(26, 115, 232), 2)
    $graphics.DrawEllipse($pen, 2, 2, $Size-4, $Size-4)
    
    # Draw search icon
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1, $Size/32))
    $centerX = $Size * 0.4
    $centerY = $Size * 0.4
    $radius = $Size * 0.15
    
    $graphics.DrawEllipse($whitePen, $centerX - $radius, $centerY - $radius, $radius * 2, $radius * 2)
    
    # Draw search handle
    $handleStartX = $centerX + $radius * 0.7
    $handleStartY = $centerY + $radius * 0.7
    $handleEndX = $centerX + $radius * 1.5
    $handleEndY = $centerY + $radius * 1.5
    $graphics.DrawLine($whitePen, $handleStartX, $handleStartY, $handleEndX, $handleEndY)
    
    # Draw enhancement symbol for larger icons
    if ($Size -ge 32) {
        $enhanceX = $Size * 0.7
        $enhanceY = $Size * 0.3
        $enhanceRadius = $Size * 0.08
        
        $yellowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(251, 188, 4))
        $graphics.FillEllipse($yellowBrush, $enhanceX - $enhanceRadius, $enhanceY - $enhanceRadius, $enhanceRadius * 2, $enhanceRadius * 2)
        
        # Draw plus sign
        $thinPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(1, $Size/64))
        $graphics.DrawLine($thinPen, $enhanceX - $enhanceRadius/2, $enhanceY, $enhanceX + $enhanceRadius/2, $enhanceY)
        $graphics.DrawLine($thinPen, $enhanceX, $enhanceY - $enhanceRadius/2, $enhanceX, $enhanceY + $enhanceRadius/2)
        $thinPen.Dispose()
        $yellowBrush.Dispose()
    }
    
    # Save the image
    $bitmap.Save($FilePath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Cleanup
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $pen.Dispose()
    $whitePen.Dispose()
    
    Write-Host "Created icon: $FilePath"
}

# Create icons directory if it doesn't exist
if (!(Test-Path "icons")) {
    New-Item -ItemType Directory -Path "icons"
}

# Create all required icon sizes
Create-Icon -Size 16 -FilePath "icons/icon16.png"
Create-Icon -Size 32 -FilePath "icons/icon32.png"
Create-Icon -Size 48 -FilePath "icons/icon48.png"
Create-Icon -Size 128 -FilePath "icons/icon128.png"

Write-Host "All icons created successfully!"