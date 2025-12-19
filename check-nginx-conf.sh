#!/bin/bash

# nginx.confの設定を確認

echo "=== nginx.confの設定を確認 ==="
echo ""

echo "1. nginx.conf の include 設定:"
sudo grep -i "include" /etc/nginx/nginx.conf | grep -E "sites|conf.d"
echo ""

echo "2. nginx.conf の全体構造:"
sudo grep -E "^[[:space:]]*(include|http|server)" /etc/nginx/nginx.conf | head -20
echo ""

echo "3. 実際に読み込まれている設定ファイル:"
sudo nginx -T 2>/dev/null | grep -E "^# configuration file|^#.*file" | head -10
echo ""

echo "4. 問題の可能性:"
echo "   - nginx.conf で sites-enabled が include されていない"
echo "   - 別の設定ファイルが使われている"
echo "   - conf.d ディレクトリが使われている"
echo ""

echo "5. conf.d の内容を確認:"
ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "conf.d ディレクトリが存在しません"
echo ""

echo "6. 推奨: nginx.conf を確認:"
echo "   sudo cat /etc/nginx/nginx.conf | grep -A 5 -B 5 include"

