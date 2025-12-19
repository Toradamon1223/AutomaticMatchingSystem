#!/bin/bash

# データベース接続を確認するスクリプト

echo "=== データベース接続確認 ==="
echo ""

echo "1. .envファイルの存在確認:"
echo "   ls -la /var/www/Tournament/backend/.env"
echo ""

echo "2. DATABASE_URLの確認（パスワード部分は隠す）:"
echo "   grep DATABASE_URL /var/www/Tournament/backend/.env | sed 's/:[^@]*@/:***@/'"
echo ""

echo "3. 環境変数が読み込まれているか確認:"
echo "   cd /var/www/Tournament/backend"
echo "   node -e \"require('dotenv').config(); console.log('DATABASE_URL:', process.env.DATABASE_URL ? '設定されています' : '設定されていません')\""
echo ""

echo "4. データベース接続テスト:"
echo "   cd /var/www/Tournament/backend"
echo "   node -e \"require('dotenv').config(); const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => { console.log('✅ 接続成功'); prisma.\$disconnect(); }).catch(e => { console.log('❌ 接続失敗:', e.message); prisma.\$disconnect(); });\""
echo ""

echo "5. よくある問題:"
echo "   - DATABASE_URLが設定されていない"
echo "   - パスワードに@が含まれていてエンコードされていない"
echo "   - .envファイルのパスが間違っている"
echo "   - Supabaseの接続設定が間違っている"
echo ""

