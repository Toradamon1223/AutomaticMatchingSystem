#!/bin/bash

# 直接接続を試すスクリプト

echo "=== 直接接続を試す ==="
echo ""

echo "ローカルで成功した接続文字列を使用します:"
echo "DATABASE_URL=\"postgresql://postgres:%40KusKus1223@db.wzktmwufngrdbuxnorqd.supabase.co:5432/postgres\""
echo ""

echo ".envファイルを更新しますか？ (y/n)"
read -r answer

if [ "$answer" = "y" ]; then
  # バックアップを取る
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  
  # 直接接続に変更
  sed -i 's|DATABASE_URL=.*|DATABASE_URL="postgresql://postgres:%40KusKus1223@db.wzktmwufngrdbuxnorqd.supabase.co:5432/postgres"|' .env
  
  echo ""
  echo "✅ .envファイルを更新しました"
  echo ""
  echo "接続テストを実行:"
  echo "node scripts/test-database-connection.js"
else
  echo "キャンセルしました"
fi

