#!/bin/bash

# 最終的なNginx設定の修正

echo "=== 最終的なNginx設定の確認と修正 ==="
echo ""

echo "1. 現在の設定ファイル全体を確認:"
sudo cat /etc/nginx/sites-available/judge-management-system
echo ""

echo "2. 推奨: 正規表現を使った確実な方法:"
cat << 'EOF'
# 正規表現で確実にマッチさせる
location ~ ^/Tournament(/.*)?$ {
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
echo "3. または、完全に別のserverブロックを使う方法:"
cat << 'EOF'
# 別のserverブロックで確実に分離
server {
    listen 443 ssl;
    server_name pcg-kansai-judge.jp;
    
    ssl_certificate /etc/letsencrypt/live/pcg-kansai-judge.jp/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pcg-kansai-judge.jp/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    location /Tournament {
        return 301 /Tournament/;
    }
    
    location /Tournament/ {
        root /var/www;
        index index.html;
        try_files $uri $uri/ /Tournament/index.html;
    }
    
    # 他の設定...
}
EOF

echo ""
echo "4. デバッグ: 実際にどのlocationがマッチしているか確認:"
echo "   Nginxのアクセスログに追加:"
echo "   log_format debug '\$request_method \$request_uri -> \$uri';"
echo "   access_log /var/log/nginx/debug.log debug;"

