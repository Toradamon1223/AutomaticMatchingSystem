#!/bin/bash

# Nginx locationマッチングのデバッグスクリプト

echo "=== Nginx locationマッチングのデバッグ ==="
echo ""

echo "1. 現在のlocation設定の順序:"
sudo grep -n "location" /etc/nginx/sites-available/judge-management-system | head -20
echo ""

echo "2. 実際に読み込まれている設定（locationの順序）:"
sudo nginx -T 2>/dev/null | grep -n "location" | head -20
echo ""

echo "3. /Tournament/ の設定が / より前にあるか確認:"
sudo nginx -T 2>/dev/null | grep -B 2 -A 15 "location /Tournament"
echo ""

echo "4. location / の設定:"
sudo nginx -T 2>/dev/null | grep -B 2 -A 10 "location / {"
echo ""

echo "5. 推奨: より具体的なlocationパターンを使う:"
cat << 'EOF'
# より具体的なパターンで確実にマッチさせる
location ~ ^/Tournament(/.*)?$ {
    alias /var/www/Tournament;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;
}

# または、location /Tournament を location / より確実に前に配置
# 設定ファイルの順序を確認
EOF

echo ""
echo "6. 設定ファイルの該当部分を確認:"
sudo sed -n '/location.*Tournament/,/^[[:space:]]*}/p' /etc/nginx/sites-available/judge-management-system
echo ""

