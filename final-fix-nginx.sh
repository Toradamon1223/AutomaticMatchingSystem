#!/bin/bash

# 最終的なNginx設定の修正スクリプト

echo "=== Nginx設定の最終確認と修正 ==="
echo ""

echo "1. 現在の設定を確認:"
sudo grep -A 10 "location.*Tournament" /etc/nginx/sites-available/judge-management-system
echo ""

echo "2. Nginx設定の構文チェック:"
sudo nginx -t
echo ""

echo "3. 実際に読み込まれている設定:"
sudo nginx -T 2>/dev/null | grep -B 5 -A 15 "location.*Tournament"
echo ""

echo "4. 推奨される設定（root を使う方法）:"
cat << 'EOF'
# /Tournament にアクセスしたときに /Tournament/ にリダイレクト
location = /Tournament {
    return 301 /Tournament/;
}

# /Tournament/ でファイルを配信（root を使用）
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
echo "5. または、alias を使う場合（より確実な方法）:"
cat << 'EOF'
# /Tournament にアクセスしたときに /Tournament/ にリダイレクト
location = /Tournament {
    return 301 /Tournament/;
}

# /Tournament/ でファイルを配信
location /Tournament/ {
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
echo "6. 設定を反映:"
echo "sudo nano /etc/nginx/sites-available/judge-management-system"
echo "sudo nginx -t"
echo "sudo systemctl restart nginx  # reload ではなく restart を試す"

