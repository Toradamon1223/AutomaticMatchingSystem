#!/bin/bash

# バックエンドのログを確認するスクリプト

echo "=== バックエンドログ確認 ==="
echo ""

echo "1. PM2のプロセス状態:"
echo "   pm2 list"
echo ""

echo "2. バックエンドのログ（最新50行）:"
echo "   pm2 logs tcg-backend --lines 50 --nostream"
echo ""

echo "3. バックエンドのエラーログ:"
echo "   pm2 logs tcg-backend --err --lines 50 --nostream"
echo ""

echo "4. バックエンドが起動しているか確認:"
echo "   curl http://localhost:5000/api/health"
echo ""

echo "5. バックエンドの再起動（必要に応じて）:"
echo "   pm2 restart tcg-backend"
echo ""

