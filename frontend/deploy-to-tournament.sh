#!/bin/bash

# デプロイスクリプト（プロジェクトを /var/www/Tournament/ に直接配置する場合）
# 使用方法: ./deploy-to-tournament.sh

set -e

echo "=== TCG Tournament System デプロイスクリプト ==="

# スクリプトの場所からプロジェクトルートを特定（どこから実行してもOK）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d ".git" ]; then
  echo "エラー: Gitリポジトリのルートで実行できません"
  exit 1
fi

# Gitから最新のコードを取得
echo "最新のコードを取得中..."
# ローカルの変更を強制的にリセット（サーバー上の変更は破棄）
# 注意: サーバー上で手動で変更したファイルは失われます
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ローカルの変更を検出しました。リモートの状態にリセットします..."
  git reset --hard HEAD
  git clean -fd
fi
# 最新のコードを取得
git fetch origin
git reset --hard origin/main

# デプロイスクリプト自体に実行権限を付与（git pullで権限がリセットされる可能性があるため）
chmod +x frontend/deploy-to-tournament.sh

# 環境変数の設定
export VITE_BASE_PATH="/Tournament"
export VITE_API_URL="${VITE_API_URL:-https://pcg-kansai-judge.jp/Tournament/api}"

# フロントエンドのビルド
echo "フロントエンドをビルド中..."
cd "$ROOT_DIR/frontend"
npm install
npm run build

# ビルド結果をルートディレクトリに移動
echo "ビルド結果を配置中..."
cd "$ROOT_DIR"
sudo rm -rf *.html *.js *.css assets 2>/dev/null || true
sudo cp -r frontend/dist/* .

# 権限の設定
echo "権限を設定中..."
sudo chown -R www-data:www-data .
sudo chmod -R 755 .

# バックエンドの再ビルドと再起動
echo "バックエンドを再ビルド中..."
cd "$ROOT_DIR/backend"
npm install
npm run build
echo "バックエンドを再起動中..."
pm2 stop tcg-backend || echo "警告: PM2の停止に失敗しました（プロセスが存在しない可能性があります）"
PORT=5001 pm2 start /var/www/Tournament/backend/dist/index.js --name tcg-backend
pm2 save

echo ""
echo "✓ デプロイ完了！"
echo "URL: https://pcg-kansai-judge.jp/Tournament"

