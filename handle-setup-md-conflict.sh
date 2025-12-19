#!/bin/bash

# SETUP.md の競合を解決するスクリプト

echo "=== SETUP.md の競合を解決 ==="
echo ""

echo "1. ローカルの変更を確認:"
echo "   git diff backend/SETUP.md"
echo ""

echo "2. ローカルの変更を破棄してリモートの変更を取り込む場合:"
echo "   git checkout -- backend/SETUP.md"
echo "   git pull"
echo ""

echo "3. ローカルの変更を保持したい場合:"
echo "   git stash"
echo "   git pull"
echo "   git stash pop"
echo ""

echo "4. ローカルの変更をコミットしてからマージする場合:"
echo "   git add backend/SETUP.md"
echo "   git commit -m 'Update: Local changes to SETUP.md'"
echo "   git pull"
echo ""

echo "推奨: ドキュメントファイルなので、ローカルの変更を破棄してリモートを取り込むのが安全です"
echo ""

