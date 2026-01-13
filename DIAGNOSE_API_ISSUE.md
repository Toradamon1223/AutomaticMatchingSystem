# APIエンドポイント404エラーの診断と修正手順

サーバーにSSH接続して、以下のコマンドを順番に実行してください。

## 1. 診断: バックエンドの状態確認

```bash
# PM2のステータス確認
pm2 list

# バックエンドがポート5000でリッスンしているか確認
sudo netstat -tlnp | grep :5000 || sudo ss -tlnp | grep :5000

# バックエンドに直接アクセスしてヘルスチェック
curl http://localhost:5000/api/health

# ログインエンドポイントを直接テスト
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  -v
```

## 2. 診断: Nginx設定の確認

```bash
# /api プロキシ設定が存在するか確認
sudo grep -A 10 "location /api" /etc/nginx/conf.d/judge-management-system.conf

# もし何も表示されない場合、設定が存在しません

# 実際に読み込まれている設定を確認
sudo nginx -T | grep -A 10 "location /api"

# Nginxのエラーログを確認
sudo tail -20 /var/log/nginx/error.log
```

## 3. 修正: Nginx設定に /api プロキシを追加

### 3-1. 設定ファイルをバックアップ

```bash
sudo cp /etc/nginx/conf.d/judge-management-system.conf /etc/nginx/conf.d/judge-management-system.conf.backup.$(date +%Y%m%d_%H%M%S)
```

### 3-2. location / の位置を確認

```bash
sudo grep -n "location / {" /etc/nginx/conf.d/judge-management-system.conf
```

### 3-3. 設定ファイルを編集

```bash
sudo nano /etc/nginx/conf.d/judge-management-system.conf
```

**編集内容**: `location / {` の**直前に**以下を追加してください：

```nginx
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
```

**重要**: `location /api` は `location /` より**前に**配置する必要があります。

### 3-4. 設定を反映

```bash
# 設定の構文チェック
sudo nginx -t

# エラーがなければ、Nginxを再起動
sudo systemctl restart nginx

# 設定が正しく読み込まれているか確認
sudo nginx -T | grep -A 10 "location /api"
```

## 4. 修正: バックエンドが起動していない場合

```bash
# バックエンドを再起動
pm2 restart tcg-backend

# または、バックエンドが存在しない場合は起動
cd /var/www/Tournament/backend
# または
cd /var/www/tcg-tournament-system/backend

pm2 start dist/index.js --name tcg-backend
pm2 save
```

## 5. 動作確認

```bash
# バックエンドに直接アクセス（ローカル）
curl http://localhost:5000/api/health

# Nginx経由でアクセス（外部から）
curl https://pcg-kansai-judge.jp/api/health

# ブラウザで以下にアクセスして確認
# https://pcg-kansai-judge.jp/api/health
```

## トラブルシューティング

### 問題: バックエンドがポート5000でリッスンしていない

```bash
# バックエンドのログを確認
pm2 logs tcg-backend --lines 50

# ポートが使われているか確認
sudo lsof -i :5000

# バックエンドを再ビルドして起動
cd /var/www/Tournament/backend  # または適切なパス
npm run build
pm2 restart tcg-backend
```

### 問題: Nginx設定が反映されない

```bash
# 実際に読み込まれている設定を確認
sudo nginx -T | grep -i "api"

# Nginxの設定ファイルの場所を確認
sudo nginx -T 2>&1 | head -20

# 全ての設定ファイルを確認
ls -la /etc/nginx/conf.d/
ls -la /etc/nginx/sites-enabled/
```

### 問題: 権限エラー

```bash
# Nginxのユーザーを確認
sudo grep "user" /etc/nginx/nginx.conf

# バックエンドプロセスの所有者を確認
ps aux | grep tcg-backend

# 必要に応じて権限を変更
sudo chown -R www-data:www-data /var/www/Tournament
```


