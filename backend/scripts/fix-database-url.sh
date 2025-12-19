#!/bin/bash

# DATABASE_URLを修正するスクリプト

echo "=== DATABASE_URL修正 ==="
echo ""

echo "Supabaseでpgbouncerを使う場合、ポート番号を6543に変更する必要があります。"
echo ""

echo "現在の設定を確認:"
grep DATABASE_URL .env | sed 's/:[^@]*@/:***@/'

echo ""
echo "修正方法:"
echo "1. ポート5432を6543に変更"
echo "2. または、?pgbouncer=trueを削除して直接接続（ポート5432）"
echo ""

echo "推奨: pgbouncerを使う場合はポート6543を使用"
echo ""

echo "修正例:"
echo "変更前: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?pgbouncer=true"
echo "変更後: postgresql://postgres:password@db.xxx.supabase.co:6543/postgres?pgbouncer=true"
echo ""

echo "または、直接接続（pgbouncerなし）:"
echo "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
echo ""

