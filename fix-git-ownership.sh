#!/bin/bash

# Git所有権の問題を解決するスクリプト

echo "=== Git所有権の問題を解決 ==="
echo ""

echo "1. 現在のディレクトリの所有権を確認:"
ls -ld /var/www/Tournament
echo ""

echo "2. Gitの安全なディレクトリとして追加（推奨）:"
echo "git config --global --add safe.directory /var/www/Tournament"
echo ""

echo "3. または、ディレクトリの所有権を変更:"
echo "sudo chown -R root:root /var/www/Tournament"
echo ""

echo "4. 複数のディレクトリを一度に追加する場合:"
echo "git config --global --add safe.directory '*'"
echo ""

echo "5. 現在のsafe.directory設定を確認:"
git config --global --get-all safe.directory
echo ""

