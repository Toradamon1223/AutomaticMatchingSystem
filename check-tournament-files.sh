#!/bin/bash

# Tournamentファイルの確認スクリプト

echo "=== Tournamentファイルの確認 ==="
echo ""

echo "1. /var/www/Tournament の内容:"
ls -la /var/www/Tournament/ | head -30
echo ""

echo "2. index.html が存在するか:"
if [ -f /var/www/Tournament/index.html ]; then
    echo "✓ index.html が存在します"
    ls -la /var/www/Tournament/index.html
    echo ""
    echo "index.html の最初の数行:"
    head -10 /var/www/Tournament/index.html
else
    echo "✗ index.html が存在しません！"
fi
echo ""

echo "3. assets ディレクトリが存在するか:"
if [ -d /var/www/Tournament/assets ]; then
    echo "✓ assets ディレクトリが存在します"
    ls -la /var/www/Tournament/assets/ | head -10
else
    echo "✗ assets ディレクトリが存在しません！"
fi
echo ""

echo "4. ファイルの権限:"
ls -ld /var/www/Tournament
echo ""

echo "5. Nginxが正しく設定を読み込んでいるか:"
sudo nginx -t
echo ""

echo "6. 実際に読み込まれている /Tournament の設定:"
sudo nginx -T 2>/dev/null | grep -A 10 "location /Tournament"
echo ""

echo "7. フロントエンドのビルド結果を確認:"
if [ -d /var/www/Tournament/frontend/dist ]; then
    echo "✓ frontend/dist が存在します"
    ls -la /var/www/Tournament/frontend/dist/ | head -10
else
    echo "✗ frontend/dist が存在しません"
fi
echo ""

echo "8. 推奨: フロントエンドを再ビルドして配置:"
echo "cd /var/www/Tournament/frontend"
echo "export VITE_BASE_PATH=\"/Tournament\""
echo "export VITE_API_URL=\"https://pcg-kansai-judge.jp/api\""
echo "npm run build"
echo "cd /var/www/Tournament"
echo "sudo rm -rf *.html *.js *.css assets 2>/dev/null || true"
echo "sudo cp -r frontend/dist/* ."
echo "sudo chown -R www-data:www-data /var/www/Tournament"

