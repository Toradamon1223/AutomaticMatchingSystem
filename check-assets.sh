#!/bin/bash

# 静的ファイルの確認スクリプト

echo "=== 静的ファイルの確認 ==="
echo ""

echo "1. assets ディレクトリの内容:"
ls -la /var/www/Tournament/assets/
echo ""

echo "2. index.html で参照されているファイルが存在するか:"
echo "index-DqNwW_iR.js:"
ls -la /var/www/Tournament/assets/index-DqNwW_iR.js 2>&1
echo ""

echo "index-COY6n2ck.css:"
ls -la /var/www/Tournament/assets/index-COY6n2ck.css 2>&1
echo ""

echo "3. vite.svg が存在するか:"
ls -la /var/www/Tournament/vite.svg 2>&1
echo ""

echo "4. curl で静的ファイルにアクセス:"
echo "JSファイル:"
curl -I http://localhost/Tournament/assets/index-DqNwW_iR.js 2>&1 | head -5
echo ""

echo "CSSファイル:"
curl -I http://localhost/Tournament/assets/index-COY6n2ck.css 2>&1 | head -5
echo ""

echo "5. Nginx設定で /Tournament/assets が正しく処理されているか:"
sudo nginx -T 2>/dev/null | grep -A 5 "location /Tournament"
echo ""

echo "6. ブラウザの開発者ツール（F12）で以下を確認:"
echo "   - Network タブで、どのファイルが404になっているか"
echo "   - Console タブで、エラーメッセージを確認"
echo ""

