#!/bin/bash

# Tournament表示問題のデバッグスクリプト

echo "=== Tournament表示問題のデバッグ ==="
echo ""

echo "1. index.html の内容確認:"
head -20 /var/www/Tournament/index.html
echo ""

echo "2. index.html に Tournament のパスが含まれているか:"
grep -i "tournament\|base" /var/www/Tournament/index.html | head -5
echo ""

echo "3. assets ディレクトリの内容:"
ls -la /var/www/Tournament/assets/ | head -10
echo ""

echo "4. Nginxのエラーログ（最新10行）:"
sudo tail -10 /var/log/nginx/error.log
echo ""

echo "5. Nginxのアクセスログ（最新5行）:"
sudo tail -5 /var/log/nginx/access.log | grep -i tournament
echo ""

echo "6. Nginx設定の構文チェック:"
sudo nginx -t
echo ""

echo "7. 実際に読み込まれている /Tournament の設定:"
sudo nginx -T 2>/dev/null | grep -A 15 "location /Tournament"
echo ""

echo "8. curl で /Tournament にアクセス:"
curl -I http://localhost/Tournament 2>&1 | head -10
echo ""

echo "9. 推奨: Nginxをリロード:"
echo "sudo systemctl reload nginx"
echo ""

echo "10. ブラウザのキャッシュをクリアするか、シークレットモードでアクセスしてください"

