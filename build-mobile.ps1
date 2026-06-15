Write-Host "Building Angular for production..." -ForegroundColor Cyan

$root        = Split-Path -Parent $MyInvocation.MyCommand.Definition
$frontendDir = Join-Path $root "frontend"
$backendStatic = Join-Path $root "backend\src\main\resources\static"
$distDir     = Join-Path $frontendDir "dist\frontend\browser"

Push-Location $frontendDir
npm run build
Pop-Location

if (-not (Test-Path $distDir)) {
    Write-Host "Build failed - dist folder not found." -ForegroundColor Red
    exit 1
}

if (Test-Path $backendStatic) {
    Remove-Item -Recurse -Force $backendStatic
}
New-Item -ItemType Directory -Force $backendStatic | Out-Null
Copy-Item -Recurse (Join-Path $distDir "*") $backendStatic

Write-Host ""
Write-Host "Done! Angular app copied into Spring Boot." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start backend:  cd backend, then npm start"
Write-Host "  2. Open tunnel:    ngrok http 8080"
Write-Host "  3. On your phone:  open the https URL in Safari (iOS) or Chrome (Android)"
Write-Host "  4. iOS:            tap Share, then Add to Home Screen"
Write-Host "  5. Android:        tap Install App banner, or Menu, Add to Home Screen"
