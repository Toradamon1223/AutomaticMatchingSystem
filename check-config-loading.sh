#!/bin/bash

# 設定ファイルの読み込みを確認

echo "=== 設定ファイルの読み込みを確認 ==="
echo ""

echo "1. sites-enabled の内容:"
ls -la /etc/nginx/sites-enabled/
echo ""

echo "2. judge-management-system が有効か確認:"
ls -la /etc/nginx/sites-enabled/ | grep judge-management-system
echo ""

echo "3. 設定ファイルの構文チェック:"
sudo nginx -t
echo ""

echo "4. 実際に読み込まれているserverブロック:"
sudo nginx -T 2>/dev/null | grep -A 2 "server_name.*pcg-kansai-judge" | head -5
echo ""

echo "5. 設定ファイルの該当部分（Tournament設定）:"
sudo grep -A 15 "location.*Tournament" /etc/nginx/sites-available/judge-management-system
echo ""

echo "6. 問題の可能性:"
echo "   - 設定ファイルが sites-enabled にリンクされていない"
echo "   - 設定ファイルに構文エラーがある"
echo "   - 別の設定ファイルが優先されている"
echo ""

echo "7. 解決方法:"
echo "   # sites-enabled にリンクを確認/作成"
echo "   sudo ln -sf /etc/nginx/sites-available/judge-management-system /etc/nginx/sites-enabled/judge-management-system"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"

