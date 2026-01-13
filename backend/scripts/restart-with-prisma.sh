#!/bin/bash
# バックエンドサーバーを再起動し、Prisma Clientを再生成するスクリプト

set -e

echo "========================================"
echo "バックエンドサーバー再起動 & Prisma Client再生成"
echo "========================================"
echo ""

# 現在のディレクトリを確認
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$BACKEND_DIR"

# 1. Prisma Clientを再生成
echo "[1/3] Prisma Clientを再生成中..."
if npm run prisma:generate; then
    echo "✅ Prisma Clientの再生成が完了しました"
else
    echo "❌ Prisma Clientの再生成に失敗しました"
    exit 1
fi

echo ""

# 2. TypeScriptをビルド
echo "[2/3] TypeScriptをビルド中..."
if npm run build; then
    echo "✅ TypeScriptのビルドが完了しました"
else
    echo "❌ TypeScriptのビルドに失敗しました"
    exit 1
fi

echo ""

# 3. PM2でサーバーを再起動（PM2が使用されている場合）
if command -v pm2 &> /dev/null; then
    echo "[3/3] PM2でサーバーを再起動中..."
    if pm2 restart tcg-backend || pm2 restart backend || pm2 restart all; then
        echo "✅ PM2でサーバーを再起動しました"
    else
        echo "⚠️  PM2の再起動に失敗しました（サーバーが起動していない可能性があります）"
        echo "    手動で起動してください: pm2 start dist/index.js --name tcg-backend"
    fi
else
    echo "[3/3] PM2が見つかりません。手動でサーバーを再起動してください。"
    echo "    開発モード: npm run dev"
    echo "    本番モード: npm start"
fi

echo ""
echo "========================================"
echo "✅ 完了しました！"
echo "========================================"

