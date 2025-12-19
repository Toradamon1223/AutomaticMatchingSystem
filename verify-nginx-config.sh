#!/bin/bash

# Nginx設定の検証スクリプト

echo "=== Nginx設定の検証 ==="
echo ""

echo "1. Nginx設定の構文チェック:"
sudo nginx -t
echo ""

echo "2. 実際に読み込まれている /Tournament の設定:"
sudo nginx -T 2>/dev/null | grep -A 15 "location.*Tournament"
echo ""

echo "3. Nginxのステータス:"
sudo systemctl status nginx --no-pager | head -10
echo ""

echo "4. リロードの確認:"
echo "sudo systemctl reload nginx"
echo ""

echo "5. curl で /Tournament にアクセス:"
curl -I http://localhost/Tournament 2>&1 | head -10
echo ""

echo "6. curl で /Tournament/ にアクセス:"
curl -I http://localhost/Tournament/ 2>&1 | head -10
echo ""

echo "7. エラーログの最新10行:"
sudo tail -10 /var/log/nginx/error.log
echo ""

echo "8. ファイルの存在確認:"
ls -la /var/www/Tournament/index.html
echo ""

echo "9. 推奨: try_files のパスを修正する場合:"
echo "   try_files \$uri \$uri/ /Tournament/index.html;"
echo "   を"
echo "   try_files \$uri \$uri/ /Tournament/index.html;"
echo "   のまま、または"
echo "   try_files \$uri \$uri/ @tournament_fallback;"
echo "   に変更し、"
echo "   location @tournament_fallback {"
echo "       rewrite ^ /Tournament/index.html last;"
echo "   }"
echo "   を追加"

