#!/bin/bash

# 正しい設定ファイルを編集

echo "=== 正しい設定ファイルを編集 ==="
echo ""

echo "1. 実際に使われている設定ファイル:"
echo "   /etc/nginx/conf.d/judge-management-system.conf"
echo ""

echo "2. 現在の設定を確認:"
sudo grep -A 10 "location.*Tournament" /etc/nginx/conf.d/judge-management-system.conf || echo "Tournament設定が見つかりません"
echo ""

echo "3. location / の位置を確認:"
sudo grep -n "location / {" /etc/nginx/conf.d/judge-management-system.conf
echo ""

echo "4. 編集コマンド:"
echo "   sudo nano /etc/nginx/conf.d/judge-management-system.conf"
echo ""

echo "5. 設定を追加する場所:"
echo "   location / の直前に以下を追加:"
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
EOF

echo ""
echo "6. 設定を反映:"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"
echo "   sudo nginx -T | grep -i tournament"

