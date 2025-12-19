#!/bin/bash

# Nginx設定の修正スクリプト

echo "=== Nginx設定の修正 ==="
echo ""

echo "現在の /Tournament の設定を確認:"
sudo grep -A 10 "location /Tournament" /etc/nginx/sites-available/judge-management-system
echo ""

echo "推奨される設定:"
cat << 'EOF'
location /Tournament {
    alias /var/www/Tournament;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;
}

# または、より確実な方法:
location /Tournament/ {
    alias /var/www/Tournament/;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;
}

location = /Tournament {
    return 301 /Tournament/;
}
EOF

echo ""
echo "設定を修正するには:"
echo "sudo nano /etc/nginx/sites-available/judge-management-system"
echo "sudo nginx -t"
echo "sudo systemctl reload nginx"

