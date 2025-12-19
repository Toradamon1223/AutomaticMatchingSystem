#!/bin/bash

# Location優先順位の修正スクリプト

echo "=== Location優先順位の修正 ==="
echo ""

echo "現在の設定:"
sudo grep -A 5 "location.*Tournament" /etc/nginx/sites-available/judge-management-system
echo ""

echo "問題: 正規表現 location ~ は通常の prefix location より優先順位が低い"
echo "解決: 通常の prefix location を使う"
echo ""

echo "推奨される設定:"
cat << 'EOF'
# /Tournament にアクセスしたときに /Tournament/ にリダイレクト
location = /Tournament {
    return 301 /Tournament/;
}

# /Tournament/ でファイルを配信（正規表現ではなく通常のprefix location）
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
EOF

echo ""
echo "修正手順:"
echo "1. sudo nano /etc/nginx/sites-available/judge-management-system"
echo "2. location ~ ^/Tournament(/.*)?$ を削除"
echo "3. 上記の location /Tournament/ に置き換え"
echo "4. sudo nginx -t"
echo "5. sudo systemctl restart nginx"

