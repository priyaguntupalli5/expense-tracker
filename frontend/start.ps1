# Starts the Angular dev server on http://localhost:4200
Set-Location $PSScriptRoot
Write-Host "Starting Angular frontend on http://localhost:4200 ..." -ForegroundColor Cyan
ng serve --open
