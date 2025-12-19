#!/bin/bash

# Nginx設定のトラブルシューティングスクリプト

echo "=== Nginx設定の確認 ==="
echo ""

echo "1. /Tournament のlocation設定を確認:"
sudo grep -A 10 "location /Tournament" /etc/nginx/sites-available/judge-management-system
echo ""

echo "2. /var/www/Tournament の内容:"
ls -la /var/www/Tournament/ | head -20
echo ""

echo "3. index.html が存在するか:"
ls -la /var/www/Tournament/index.html
echo ""

echo "4. Nginx設定の構文チェック:"
sudo nginx -t
echo ""

echo "5. 実際に読み込まれている /Tournament の設定:"
sudo nginx -T 2>/dev/null | grep -A 15 "location /Tournament"
echo ""

echo "6. 既存のlocation設定（競合の可能性）:"
sudo grep -E "location /|location ~" /etc/nginx/sites-available/judge-management-system | head -20
echo ""

echo "7. server_name の設定:"
sudo grep "server_name" /etc/nginx/sites-available/judge-management-system
echo ""

