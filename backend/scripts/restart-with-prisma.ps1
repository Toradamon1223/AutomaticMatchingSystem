# バックエンドサーバーを再起動し、Prisma Clientを再生成するスクリプト (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "バックエンドサーバー再起動 & Prisma Client再生成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 現在のディレクトリを確認
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Split-Path -Parent $SCRIPT_DIR

Set-Location $BACKEND_DIR

# 1. Prisma Clientを再生成
Write-Host "[1/3] Prisma Clientを再生成中..." -ForegroundColor Yellow
try {
    npm run prisma:generate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Prisma Clientの再生成に失敗しました" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Prisma Clientの再生成が完了しました" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. TypeScriptをビルド
Write-Host "[2/3] TypeScriptをビルド中..." -ForegroundColor Yellow
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] TypeScriptのビルドに失敗しました" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] TypeScriptのビルドが完了しました" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. PM2でサーバーを再起動（PM2が使用されている場合）
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    Write-Host "[3/3] PM2でサーバーを再起動中..." -ForegroundColor Yellow
    try {
        pm2 restart tcg-backend 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] PM2でサーバーを再起動しました" -ForegroundColor Green
        } else {
            pm2 restart backend 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] PM2でサーバーを再起動しました" -ForegroundColor Green
            } else {
                pm2 restart all 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[OK] PM2でサーバーを再起動しました" -ForegroundColor Green
                } else {
                    Write-Host "[WARN] PM2の再起動に失敗しました（サーバーが起動していない可能性があります）" -ForegroundColor Yellow
                    Write-Host "      手動で起動してください: pm2 start dist/index.js --name tcg-backend" -ForegroundColor Yellow
                }
            }
        }
    } catch {
        Write-Host "[WARN] PM2の再起動に失敗しました" -ForegroundColor Yellow
    }
} else {
    Write-Host "[3/3] PM2が見つかりません。手動でサーバーを再起動してください。" -ForegroundColor Yellow
    Write-Host "      開発モード: npm run dev" -ForegroundColor Yellow
    Write-Host "      本番モード: npm start" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[OK] 完了しました！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

