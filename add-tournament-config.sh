#!/bin/bash

# Tournament設定を追加するスクリプト

echo "=== Tournament設定を追加 ==="
echo ""

echo "現在の設定ファイル:"
echo "/etc/nginx/conf.d/judge-management-system.conf"
echo ""

echo "追加する設定（location /_next/static の後、location / の前に追加）:"
cat << 'EOF'
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

    # APIプロキシ設定
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
EOF

echo ""
echo "編集手順:"
echo "1. sudo nano /etc/nginx/conf.d/judge-management-system.conf"
echo "2. location /_next/static の後、location / の前に上記の設定を追加"
echo "3. sudo nginx -t"
echo "4. sudo systemctl restart nginx"
echo "5. sudo nginx -T | grep -i tournament"

