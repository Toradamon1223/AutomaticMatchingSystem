#!/bin/bash

# Nginx設定ファイルの確認スクリプト

echo "=== Nginx設定ファイルの確認 ==="
echo ""

echo "1. sites-available の内容:"
ls -la /etc/nginx/sites-available/
echo ""

echo "2. sites-enabled の内容（実際に有効になっている設定）:"
ls -la /etc/nginx/sites-enabled/
echo ""

echo "3. メインの設定ファイル（nginx.conf）:"
grep -E "include.*sites-enabled" /etc/nginx/nginx.conf 2>/dev/null || echo "nginx.conf に sites-enabled の include が見つかりません"
echo ""

echo "4. 実際に読み込まれている設定ファイル:"
sudo nginx -T 2>/dev/null | grep -E "configuration file|# configuration file" | head -5
echo ""

echo "5. 設定ファイルの構文チェック:"
sudo nginx -t
echo ""

echo "6. 各設定ファイルの server_name を確認:"
for file in /etc/nginx/sites-available/*; do
    if [ -f "$file" ]; then
        echo "--- $(basename $file) ---"
        grep -E "server_name|listen" "$file" | head -3
        echo ""
    fi
done

