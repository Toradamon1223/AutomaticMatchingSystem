#!/bin/bash

# Tournament設定を探す

echo "=== Tournament設定を探す ==="
echo ""

echo "1. 全ての設定ファイルで Tournament を検索:"
sudo grep -r "Tournament" /etc/nginx/sites-available/ /etc/nginx/conf.d/ 2>/dev/null | head -20
echo ""

echo "2. sites-enabled の内容:"
ls -la /etc/nginx/sites-enabled/
echo ""

echo "3. 各設定ファイルの内容:"
for file in /etc/nginx/sites-enabled/*; do
    if [ -f "$file" ]; then
        echo "--- $(basename $file) ---"
        sudo grep -n "Tournament" "$file" || echo "Tournament設定なし"
        echo ""
    fi
done

echo "4. 実際に読み込まれている全てのlocation:"
sudo nginx -T 2>/dev/null | grep "location" | head -30
echo ""

echo "5. 推奨: 設定ファイルを確認:"
echo "   sudo cat /etc/nginx/sites-available/judge-management-system | grep -A 10 Tournament"

