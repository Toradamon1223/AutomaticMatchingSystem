#!/bin/bash

# HTTPSで直接テスト

echo "=== HTTPSで直接テスト ==="
echo ""

echo "1. HTTPSで /Tournament/ に直接アクセス:"
curl -k -v https://localhost/Tournament/ 2>&1 | grep -E "HTTP|Location|Content-Type|<!doctype"
echo ""

echo "2. HTTPSで /Tournament/index.html に直接アクセス:"
curl -k https://localhost/Tournament/index.html 2>&1 | head -5
echo ""

echo "3. 実際に読み込まれている設定を確認:"
sudo nginx -T 2>/dev/null | grep -B 2 -A 15 "location.*Tournament"
echo ""

echo "4. 問題の可能性:"
echo "   - location /Tournament/ が location / より前に配置されているか確認"
echo "   - try_files のパスが正しいか確認"
echo "   - root のパスが正しいか確認"
echo ""

echo "5. 推奨: より確実な設定:"
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

