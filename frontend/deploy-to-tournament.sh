#!/bin/bash

# デプロイスクリプト（プロジェクトを /var/www/Tournament/ に直接配置する場合）
# 使用方法: ./deploy-to-tournament.sh

set -e

echo "=== TCG Tournament System デプロイスクリプト ==="

# 現在のディレクトリが /var/www/Tournament であることを確認
if [ "$(basename $(pwd))" != "Tournament" ]; then
    echo "エラー: このスクリプトは /var/www/Tournament ディレクトリから実行してください"
    exit 1
fi

# 環境変数の設定
export VITE_BASE_PATH="/Tournament"
export VITE_API_URL="${VITE_API_URL:-https://pcg-kansai-judge/api}"

# フロントエンドのビルド
echo "フロントエンドをビルド中..."
cd frontend
npm install
npm run build

# ビルド結果をルートディレクトリに移動
echo "ビルド結果を配置中..."
cd ..
sudo rm -rf *.html *.js *.css assets 2>/dev/null || true
sudo cp -r frontend/dist/* .

# 権限の設定
echo "権限を設定中..."
sudo chown -R www-data:www-data .
sudo chmod -R 755 .

echo "デプロイ完了！"
echo "URL: https://pcg-kansai-judge/Tournament"

