Write-Host "Building Angular for production..." -ForegroundColor Cyan

$root    = $PSScriptRoot
$frontendDir = Join-Path $root "frontend"
$backendStatic = Join-Path $root "backend\src\main\resources\static"
$distDir = Join-Path $frontendDir "dist\frontend\browser"

# Build Angular
Push-Location $frontendDir
npm run build
Pop-Location

if (-not (Test-Path $distDir)) {
    Write-Host "Build failed — dist folder not found." -ForegroundColor Red
    exit 1
}

# Clear and copy to Spring Boot static resources
if (Test-Path $backendStatic) {
    Remove-Item -Recurse -Force $backendStatic
}
New-Item -ItemType Directory -Force $backendStatic | Out-Null
Copy-Item -Recurse "$distDir\*" $backendStatic

Write-Host ""
Write-Host "Done! Angular app is ready inside Spring Boot." -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start backend:   cd backend  then  npm start"
Write-Host "  2. Open tunnel:     ngrok http 8080"
Write-Host "  3. On iPhone:       open the https://xxxx.ngrok-free.app URL in Safari"
Write-Host "  4.                  tap Share -> Add to Home Screen"
