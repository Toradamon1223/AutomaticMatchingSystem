#!/bin/bash

# 実際に読み込まれている設定を確認

echo "=== 実際に読み込まれている設定を確認 ==="
echo ""

echo "1. Nginx設定の構文チェック:"
sudo nginx -t 2>&1
echo ""

echo "2. 実際に読み込まれている設定（Tournament関連）:"
sudo nginx -T 2>/dev/null | grep -B 5 -A 20 "location.*Tournament" || echo "設定が見つかりません"
echo ""

echo "3. location / の設定:"
sudo nginx -T 2>/dev/null | grep -B 5 -A 15 "location / {" | head -25
echo ""

echo "4. 問題の可能性:"
echo "   - location ^~ /Tournament/ が location / より前に配置されているか"
echo "   - Judge System（Next.js）が全てのリクエストをキャッチしている"
echo "   - Next.jsのミドルウェアで /Tournament を除外する必要がある"
echo ""

echo "5. 推奨: Judge System側で /Tournament を除外:"
echo "   Next.jsの場合、middleware.ts または next.config.js で除外設定が必要"
echo ""

echo "6. または、Nginxで完全に分離:"
cat << 'EOF'
# /Tournament を完全に分離（Judge Systemにプロキシしない）
location ^~ /Tournament {
    alias /var/www/Tournament;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;
}
EOF

