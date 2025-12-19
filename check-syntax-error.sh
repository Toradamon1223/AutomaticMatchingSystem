#!/bin/bash

# 構文エラーを確認

echo "=== 構文エラーを確認 ==="
echo ""

echo "1. 設定ファイルの構文チェック（詳細）:"
sudo nginx -t 2>&1
echo ""

echo "2. 設定ファイルの該当部分を確認（構文エラーの可能性）:"
sudo sed -n '/location.*Tournament/,/^[[:space:]]*}/p' /etc/nginx/sites-available/judge-management-system
echo ""

echo "3. serverブロック全体を確認:"
sudo grep -n "server {" /etc/nginx/sites-available/judge-management-system
echo ""

echo "4. 実際に読み込まれているserverブロック:"
sudo nginx -T 2>/dev/null | grep -A 2 "server_name.*pcg-kansai-judge" | head -10
echo ""

echo "5. 設定ファイルの該当部分（location /Tournament の前後）:"
sudo sed -n '/location.*Tournament/,/location \//p' /etc/nginx/sites-available/judge-management-system | head -30
echo ""

echo "6. 問題の可能性:"
echo "   - serverブロック内の構文エラー"
echo "   - locationブロックが正しく閉じられていない"
echo "   - 別のserverブロックが優先されている"
echo ""

echo "7. 推奨: 設定ファイル全体を確認:"
echo "   sudo cat /etc/nginx/sites-available/judge-management-system | grep -A 5 -B 5 Tournament"

