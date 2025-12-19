#!/bin/bash

# ローカル環境でマイグレーションを適用するスクリプト

echo "=== ローカル環境でのマイグレーション適用 ==="
echo ""

echo "オプション1: .envファイルをSession Poolerに変更"
echo "  backend/.env の DATABASE_URL を以下に変更:"
echo "  DATABASE_URL=\"postgresql://postgres.wzktmwufngrdbuxnorqd:%40KusKus1223@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres\""
echo ""

echo "オプション2: マイグレーションファイルを手動で適用"
echo "  SupabaseダッシュボードのSQL Editorで以下を実行:"
echo ""
cat backend/prisma/migrations/20251219000000_add_registration_end_time/migration.sql
echo ""

echo "オプション3: Prisma Migrate Deployを使用（本番環境用）"
echo "  npx prisma migrate deploy"
echo ""

