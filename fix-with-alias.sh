#!/bin/bash

# aliasを使った修正

echo "=== aliasを使った修正 ==="
echo ""

echo "現在の設定:"
sudo grep -A 10 "location.*Tournament" /etc/nginx/sites-available/judge-management-system
echo ""

echo "推奨: aliasを使った設定:"
cat << 'EOF'
# /Tournament にアクセスしたときに /Tournament/ にリダイレクト
location = /Tournament {
    return 301 /Tournament/;
}

# /Tournament/ でファイルを配信（alias を使用）
location ^~ /Tournament/ {
    alias /var/www/Tournament/;
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
echo "重要:"
echo "  - root の代わりに alias を使用"
echo "  - alias のパスは末尾にスラッシュを付ける: /var/www/Tournament/"
echo "  - ^~ 修飾子で確実に優先"

