#!/bin/bash

# 実際に使われているNginx設定を確認するスクリプト

echo "=== Nginx設定ファイルの確認 ==="
echo ""

echo "1. 有効になっている設定ファイル:"
ls -la /etc/nginx/sites-enabled/
echo ""

echo "2. default の server_name と listen:"
grep -E "server_name|listen" /etc/nginx/sites-available/default | head -5
echo ""

echo "3. judge-management-system の server_name と listen:"
grep -E "server_name|listen" /etc/nginx/sites-available/judge-management-system | head -5
echo ""

echo "4. 実際に読み込まれている設定（pcg-kansai-judge.jp に関連する部分）:"
sudo nginx -T 2>/dev/null | grep -A 10 -B 5 "pcg-kansai-judge\|server_name" | head -30
echo ""

echo "5. 推奨: judge-management-system に設定を追加してください"
echo "   理由: 通常、アプリケーション用の設定ファイルの方が適切です"

