# TCG Tournament System - Build Script
# Build backend and frontend sequentially

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TCG Tournament System - Build Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Build backend
Write-Host "[1/2] Building backend..." -ForegroundColor Yellow
Push-Location backend
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Backend build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "[OK] Backend build completed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Write-Host ""

# Build frontend
Write-Host "[2/2] Building frontend..." -ForegroundColor Yellow
Push-Location frontend
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Frontend build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "[OK] Frontend build completed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[OK] All builds completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
