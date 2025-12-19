#!/bin/bash

# 最終的な解決策

echo "=== 最終的な解決策 ==="
echo ""

echo "1. 現在の設定を確認:"
sudo grep -A 10 "location.*Tournament" /etc/nginx/sites-available/judge-management-system
echo ""

echo "2. Nginx設定の構文チェック:"
sudo nginx -t
echo ""

echo "3. 実際に読み込まれている設定:"
sudo nginx -T 2>/dev/null | grep -B 2 -A 15 "location.*Tournament" || echo "設定が見つかりません"
echo ""

echo "4. 推奨: 以下の設定に置き換え:"
cat << 'EOF'
# /Tournament にアクセスしたときに /Tournament/ にリダイレクト
location = /Tournament {
    return 301 /Tournament/;
}

# /Tournament/ でファイルを配信（^~ で確実に優先）
location ^~ /Tournament/ {
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
echo "5. 設定を反映:"
echo "   sudo nano /etc/nginx/sites-available/judge-management-system"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"
echo ""

echo "6. 確認:"
echo "   curl -k https://localhost/Tournament/ | head -10"

