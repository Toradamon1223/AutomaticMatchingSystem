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

# Gitから最新のコードを取得
echo "最新のコードを取得中..."
# ローカルの変更を一時的に退避
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ローカルの変更を検出しました。一時的に退避します..."
  git stash push -m "Auto-stash before deploy $(date +%Y%m%d_%H%M%S)"
fi
# 最新のコードを取得
git pull

# デプロイスクリプト自体に実行権限を付与（git pullで権限がリセットされる可能性があるため）
chmod +x frontend/deploy-to-tournament.sh

# 環境変数の設定
export VITE_BASE_PATH="/Tournament"
export VITE_API_URL="${VITE_API_URL:-https://pcg-kansai-judge.jp/api}"

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

# バックエンドの再ビルドと再起動
echo "バックエンドを再ビルド中..."
cd backend
npm install
npm run build
echo "バックエンドを再起動中..."
pm2 restart tcg-backend || echo "警告: PM2の再起動に失敗しました（プロセスが存在しない可能性があります）"

echo ""
echo "✓ デプロイ完了！"
echo "URL: https://pcg-kansai-judge.jp/Tournament"

