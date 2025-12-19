#!/bin/bash

# 実際に使われている設定ファイルを探す

echo "=== 実際に使われている設定ファイルを探す ==="
echo ""

echo "1. conf.d の内容:"
ls -la /etc/nginx/conf.d/
echo ""

echo "2. conf.d 内のファイルで pcg-kansai-judge を検索:"
sudo grep -r "pcg-kansai-judge" /etc/nginx/conf.d/ 2>/dev/null
echo ""

echo "3. conf.d 内のファイルで server_name を検索:"
sudo grep -r "server_name" /etc/nginx/conf.d/ 2>/dev/null | head -10
echo ""

echo "4. 実際に読み込まれている設定ファイル:"
sudo nginx -T 2>/dev/null | grep -E "^# configuration file|^#.*file" | head -10
echo ""

echo "5. 実際に読み込まれているserverブロック:"
sudo nginx -T 2>/dev/null | grep -A 2 "server_name.*pcg-kansai-judge" | head -10
echo ""

echo "6. 推奨: conf.d 内の設定ファイルを確認:"
echo "   sudo cat /etc/nginx/conf.d/*.conf | grep -A 5 -B 5 pcg-kansai-judge"

