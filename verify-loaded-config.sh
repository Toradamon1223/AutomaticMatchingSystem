#!/bin/bash

# 読み込まれている設定を確認

echo "=== 読み込まれている設定を確認 ==="
echo ""

echo "1. 全てのlocation設定を確認:"
sudo nginx -T 2>/dev/null | grep "^[[:space:]]*location" | head -30
echo ""

echo "2. Tournament を含む行を検索:"
sudo nginx -T 2>/dev/null | grep -i "tournament" | head -20
echo ""

echo "3. location / の前後を確認:"
sudo nginx -T 2>/dev/null | grep -B 10 -A 5 "^[[:space:]]*location / {" | head -20
echo ""

echo "4. 設定ファイルの構文チェック:"
sudo nginx -t
echo ""

echo "5. 設定ファイルの該当部分を確認:"
sudo sed -n '/location.*Tournament/,/^[[:space:]]*location/p' /etc/nginx/sites-available/judge-management-system | head -25
echo ""

echo "6. 問題の可能性:"
echo "   - 設定ファイルに構文エラーがある"
echo "   - location /Tournament が location / より後に配置されている"
echo "   - 別の設定ファイルが優先されている"
echo ""

echo "7. 推奨: 設定ファイル全体を確認:"
echo "   sudo cat /etc/nginx/sites-available/judge-management-system"

