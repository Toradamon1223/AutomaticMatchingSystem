#!/bin/bash

# バックエンドを再起動するスクリプト

echo "=== バックエンド再起動 ==="
echo ""

echo "1. .envファイルの確認:"
cat .env | grep -E "DATABASE_URL|JWT_SECRET|PORT|FRONTEND_URL" | sed 's/:[^@]*@/:***@/'
echo ""

echo "2. Prismaクライアントを再生成:"
npx prisma generate
echo ""

echo "3. バックエンドを再ビルド:"
npm run build
echo ""

echo "4. PM2でバックエンドを再起動:"
pm2 restart tcg-backend
echo ""

echo "5. ログを確認:"
echo "   pm2 logs tcg-backend --lines 20"
echo ""

