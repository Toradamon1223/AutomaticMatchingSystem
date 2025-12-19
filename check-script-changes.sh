#!/bin/bash

# スクリプトファイルの変更を確認するスクリプト

echo "=== ローカルの変更を確認 ==="
echo ""

echo "1. create-test-users.js の変更:"
echo "   git diff backend/scripts/create-test-users.js"
echo ""

echo "2. make-admin.js の変更:"
echo "   git diff backend/scripts/make-admin.js"
echo ""

echo "3. 変更を破棄してリモートを取り込む場合:"
echo "   git checkout -- backend/scripts/create-test-users.js backend/scripts/make-admin.js"
echo "   git pull"
echo ""

echo "4. 変更を保持したい場合:"
echo "   git stash"
echo "   git pull"
echo "   git stash pop"
echo ""

echo "推奨: スクリプトファイルなので、ローカルの変更を破棄してリモートを取り込むのが安全です"
echo ""

