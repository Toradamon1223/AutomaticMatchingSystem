#!/bin/bash

echo "=== APIプロキシ設定の確認と追加スクリプト ==="
echo ""

CONFIG_FILE="/etc/nginx/conf.d/judge-management-system.conf"

echo "1. 現在のnginx設定ファイルを確認:"
echo "   ファイル: $CONFIG_FILE"
echo ""

echo "2. /api プロキシ設定が存在するか確認:"
if sudo grep -q "location /api" "$CONFIG_FILE"; then
    echo "   ✓ /api プロキシ設定が見つかりました:"
    sudo grep -A 10 "location /api" "$CONFIG_FILE"
else
    echo "   ✗ /api プロキシ設定が見つかりません"
    echo ""
    echo "   追加する設定:"
    cat << 'EOF'
    # APIプロキシ設定（location / より前に配置）
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
EOF
    echo ""
    echo "   編集手順:"
    echo "   1. sudo nano $CONFIG_FILE"
    echo "   2. location / の直前に上記の設定を追加"
    echo "   3. sudo nginx -t"
    echo "   4. sudo systemctl restart nginx"
fi

echo ""
echo "3. バックエンドがポート5000でリッスンしているか確認:"
if sudo netstat -tlnp 2>/dev/null | grep -q ":5000" || sudo ss -tlnp 2>/dev/null | grep -q ":5000"; then
    echo "   ✓ ポート5000でリッスンしています"
    sudo netstat -tlnp 2>/dev/null | grep ":5000" || sudo ss -tlnp 2>/dev/null | grep ":5000"
else
    echo "   ✗ ポート5000でリッスンしていません"
    echo "   PM2のステータスを確認: pm2 list"
    echo "   バックエンドを再起動: pm2 restart tcg-backend"
fi

echo ""
echo "4. バックエンドに直接アクセスしてヘルスチェック:"
if curl -s http://localhost:5000/api/health > /dev/null; then
    echo "   ✓ バックエンドは正常に応答しています"
    curl -s http://localhost:5000/api/health
else
    echo "   ✗ バックエンドに接続できません"
    echo "   バックエンドのログを確認: pm2 logs tcg-backend --lines 50"
fi

echo ""
echo "5. Nginx設定の構文チェック:"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✓ Nginx設定の構文は正しいです"
else
    echo "   ✗ Nginx設定にエラーがあります:"
    sudo nginx -t
fi

echo ""
echo "=== 診断完了 ==="


