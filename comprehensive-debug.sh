#!/bin/bash

# 包括的なデバッグスクリプト

echo "=== 包括的なデバッグ ==="
echo ""

echo "1. 現在のNginx設定全体を確認:"
sudo cat /etc/nginx/sites-available/judge-management-system
echo ""

echo "2. 実際に読み込まれている設定:"
sudo nginx -T 2>/dev/null | grep -B 2 -A 15 "location.*Tournament"
echo ""

echo "3. curlで直接テスト:"
echo "   /Tournament へのアクセス:"
curl -v http://localhost/Tournament 2>&1 | grep -E "HTTP|Location|Server"
echo ""
echo "   /Tournament/ へのアクセス:"
curl -v http://localhost/Tournament/ 2>&1 | grep -E "HTTP|Location|Server"
echo ""

echo "4. ファイルの存在確認:"
ls -la /var/www/Tournament/index.html
ls -la /var/www/Tournament/assets/ | head -5
echo ""

echo "5. ファイルの内容確認（最初の20行）:"
head -20 /var/www/Tournament/index.html
echo ""

echo "6. Nginxのエラーログ（最新20行）:"
sudo tail -20 /var/log/nginx/error.log
echo ""

echo "7. Nginxのアクセスログ（Tournament関連、最新10行）:"
sudo tail -100 /var/log/nginx/access.log | grep Tournament | tail -10
echo ""

echo "8. 推奨: 別のアプローチ - 完全に別のlocationブロックを使う:"
cat << 'EOF'
# より確実な方法: 正規表現で確実にマッチし、^~ で優先させる
location ~ ^/Tournament {
    alias /var/www/Tournament;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;
}

# または、完全に別のserverブロックを使う（ただし、同じドメインなので難しい）
EOF

