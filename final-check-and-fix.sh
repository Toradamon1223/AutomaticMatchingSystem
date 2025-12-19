#!/bin/bash

# 最終確認と修正

echo "=== 最終確認と修正 ==="
echo ""

echo "1. 現在の設定を確認:"
sudo grep -B 2 -A 15 "location.*Tournament" /etc/nginx/sites-available/judge-management-system
echo ""

echo "2. location / の位置を確認:"
sudo grep -n "location / {" /etc/nginx/sites-available/judge-management-system
echo ""

echo "3. 実際に読み込まれている全てのlocation:"
sudo nginx -T 2>/dev/null | grep "^[[:space:]]*location" | head -20
echo ""

echo "4. 推奨: alias に変更して、location / の直前に配置:"
cat << 'EOF'
# location / の直前に以下を配置

# /Tournament でファイルを配信（^~ で確実に優先）
location ^~ /Tournament {
    alias /var/www/Tournament;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;

    # 静的ファイルのキャッシュ設定
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo ""
echo "5. 設定ファイルの該当部分を確認（location / の前後）:"
sudo sed -n '/location.*Tournament/,/location \//p' /etc/nginx/sites-available/judge-management-system | head -30

