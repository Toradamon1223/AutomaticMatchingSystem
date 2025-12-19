#!/bin/bash

# Git競合を解決するスクリプト

echo "=== Git競合の解決 ==="
echo ""

echo "1. 現在の変更を確認:"
git status
echo ""

echo "2. 変更内容を確認:"
git diff DEPLOY_SERVER.md | head -30
echo ""

echo "3. 解決方法の選択:"
echo ""
echo "方法1: 変更をstashして、後で適用（推奨）"
echo "   git stash"
echo "   git pull"
echo "   git stash pop  # 必要に応じて"
echo ""

echo "方法2: サーバー側の変更を破棄して、リモートの変更を採用"
echo "   git checkout -- DEPLOY_SERVER.md"
echo "   git pull"
echo ""

echo "方法3: 変更をコミットしてからpull"
echo "   git add DEPLOY_SERVER.md"
echo "   git commit -m 'Local changes'"
echo "   git pull"
echo ""

