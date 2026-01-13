#!/bin/bash
# TCG Tournament System - ビルドスクリプト (Bash)
# バックエンドとフロントエンドを順番にビルドします

set -e

echo "========================================"
echo "TCG Tournament System - ビルド開始"
echo "========================================"
echo ""

# バックエンドのビルド
echo "[1/2] バックエンドをビルド中..."
cd backend
if npm run build; then
    echo "✅ バックエンドのビルドが完了しました"
else
    echo "❌ バックエンドのビルドに失敗しました"
    exit 1
fi
cd ..

echo ""

# フロントエンドのビルド
echo "[2/2] フロントエンドをビルド中..."
cd frontend
if npm run build; then
    echo "✅ フロントエンドのビルドが完了しました"
else
    echo "❌ フロントエンドのビルドに失敗しました"
    exit 1
fi
cd ..

echo ""
echo "========================================"
echo "✅ すべてのビルドが完了しました！"
echo "========================================"

