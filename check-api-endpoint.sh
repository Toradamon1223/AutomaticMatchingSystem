#!/bin/bash

echo "=== APIエンドポイント診断スクリプト ==="
echo ""

echo "1. PM2のステータスを確認:"
pm2 list
echo ""

echo "2. バックエンドプロセスがポート5000でリッスンしているか確認:"
sudo netstat -tlnp | grep :5000 || sudo ss -tlnp | grep :5000
echo ""

echo "3. バックエンドに直接アクセスしてヘルスチェック:"
curl -v http://localhost:5000/api/health 2>&1 | head -20
echo ""

echo "4. バックエンドに直接ログインエンドポイントをテスト:"
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -v 2>&1 | head -30
echo ""

echo "5. Nginx設定で /api プロキシが設定されているか確認:"
sudo nginx -T 2>&1 | grep -A 10 "location /api" | head -15
echo ""

echo "6. Nginxのエラーログ（最新10行）:"
sudo tail -10 /var/log/nginx/error.log
echo ""

echo "7. 実際に読み込まれているNginx設定を確認:"
sudo nginx -T 2>&1 | grep -B 5 -A 15 "location.*api" | head -25
echo ""

echo "=== 診断完了 ==="
echo ""
echo "解決方法:"
echo "1. バックエンドが起動していない場合: pm2 restart tcg-backend"
echo "2. Nginxの /api プロキシ設定がない場合: /etc/nginx/conf.d/judge-management-system.conf に追加"
echo "3. 設定を反映: sudo nginx -t && sudo systemctl restart nginx"


