#!/bin/bash

# 最終的なNginx設定のデバッグと修正

echo "=== Nginx設定の最終デバッグ ==="
echo ""

echo "1. 現在のlocation設定の順序を確認:"
sudo grep -n "location" /etc/nginx/sites-available/judge-management-system | head -20
echo ""

echo "2. 実際に読み込まれている設定:"
sudo nginx -T 2>/dev/null | grep -B 2 -A 15 "location.*Tournament"
echo ""

echo "3. アクセスログを確認（最新10行）:"
sudo tail -10 /var/log/nginx/access.log | grep Tournament
echo ""

echo "4. エラーログを確認（最新10行）:"
sudo tail -10 /var/log/nginx/error.log
echo ""

echo "5. 推奨: より確実な設定（location / の直前に配置）:"
cat << 'EOF'
# 設定ファイル内で、location / の直前に以下を配置
# （location / より前に確実に配置する）

# /Tournament にアクセスしたときに /Tournament/ にリダイレクト
location = /Tournament {
    return 301 /Tournament/;
}

# /Tournament/ でファイルを配信
location /Tournament/ {
    root /var/www;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;
    
    # 静的ファイルのキャッシュ設定
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# この後に location / を配置
EOF

echo ""
echo "6. 設定ファイルの該当部分を確認:"
sudo sed -n '/location.*Tournament/,/^[[:space:]]*}/p' /etc/nginx/sites-available/judge-management-system
echo ""

echo "7. location / の位置を確認:"
sudo grep -n "location / {" /etc/nginx/sites-available/judge-management-system
echo ""

