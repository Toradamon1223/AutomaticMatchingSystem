#!/bin/bash

# 根本原因の分析

echo "=== 根本原因の分析 ==="
echo ""

echo "1. 設定ファイル全体を確認（locationの順序）:"
sudo cat /etc/nginx/sites-available/judge-management-system | grep -n "location" | head -20
echo ""

echo "2. location /Tournament/ の前後を確認:"
sudo sed -n '/location.*Tournament/,/^[[:space:]]*location/p' /etc/nginx/sites-available/judge-management-system | head -20
echo ""

echo "3. 実際に読み込まれている設定:"
sudo nginx -T 2>/dev/null | grep -B 5 -A 15 "location.*Tournament"
echo ""

echo "4. 実際にどのlocationがマッチしているか確認（デバッグログを有効にする）:"
echo "   設定ファイルに以下を追加:"
cat << 'EOF'
    # デバッグログを有効にする（一時的）
    error_log /var/log/nginx/debug.log debug;
EOF
echo ""

echo "5. 別のアプローチ: Judge Systemのアプリケーション側でリダイレクトしている可能性:"
echo "   - Judge Systemが /Tournament へのアクセスを検知して /login にリダイレクトしている可能性"
echo "   - この場合、Nginx設定だけでは解決できない"
echo ""

echo "6. 確認: Judge Systemのアプリケーション設定:"
echo "   - Judge Systemが /Tournament パスを処理していないか確認"
echo "   - Judge Systemのルーティング設定を確認"
echo ""

echo "7. 推奨: 完全に別のパスを試す（テスト用）:"
cat << 'EOF'
location ^~ /tournament-test/ {
    alias /var/www/Tournament/;
    index index.html;
    try_files $uri $uri/ /tournament-test/index.html;
}
EOF
echo "   これで動作すれば、パスの問題ではなく、Judge System側の問題の可能性が高い"

