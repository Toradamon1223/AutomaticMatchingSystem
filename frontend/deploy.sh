#!/bin/bash

# デプロイスクリプト
# 使用方法: ./deploy.sh

set -e

echo "=== TCG Tournament System デプロイスクリプト ==="

# 環境変数の設定
export VITE_BASE_PATH="/Tournament"
export VITE_API_URL="${VITE_API_URL:-https://pcg-kansai-judge.jp/api}"

# フロントエンドのビルド
echo "フロントエンドをビルド中..."
cd frontend
npm install
npm run build

# デプロイ先ディレクトリ
DEPLOY_DIR="/var/www/Tournament"

echo "デプロイ先: $DEPLOY_DIR"

# デプロイ先ディレクトリの作成（存在しない場合）
sudo mkdir -p "$DEPLOY_DIR"

# 既存ファイルのバックアップ（オプション）
if [ -d "$DEPLOY_DIR" ] && [ "$(ls -A $DEPLOY_DIR)" ]; then
    echo "既存ファイルをバックアップ中..."
    sudo cp -r "$DEPLOY_DIR" "${DEPLOY_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# ビルド結果をデプロイ先にコピー
echo "ファイルをコピー中..."
sudo rm -rf "$DEPLOY_DIR"/*
sudo cp -r dist/* "$DEPLOY_DIR/"

# 権限の設定
echo "権限を設定中..."
sudo chown -R www-data:www-data "$DEPLOY_DIR"
sudo chmod -R 755 "$DEPLOY_DIR"

echo "デプロイ完了！"
echo "URL: https://pcg-kansai-judge.jp/Tournament"

