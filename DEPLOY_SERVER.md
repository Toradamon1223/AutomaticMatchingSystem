# サーバーデプロイガイド

`https://pcg-kansai-judge.jp/Tournament` にデプロイする手順です。

## 前提条件

- サーバーにSSHアクセスできること
- Node.js 18以上がインストールされていること
- Nginxがインストール・設定されていること
- `/var/www/Tournament` ディレクトリに書き込み権限があること

## デプロイ手順

### 1. リポジトリをクローン（初回のみ）

プロジェクトを `/var/www/Tournament/` に直接配置する場合：

```bash
cd /var/www
git clone <your-repo-url> Tournament
cd Tournament
```

または、別の場所にソースコードを置いて、ビルド結果だけを `/var/www/Tournament/` に配置する場合：

```bash
cd /var/www
git clone <your-repo-url> tcg-tournament-system
cd tcg-tournament-system
```

### 2. 環境変数の設定

フロントエンド用の環境変数を設定：

```bash
cd frontend
cat > .env << EOF
VITE_BASE_PATH=/Tournament
VITE_API_URL=https://pcg-kansai-judge.jp/api
EOF
```

バックエンド用の環境変数も設定（バックエンドを同じサーバーにデプロイする場合）：

```bash
cd ../backend
cat > .env << EOF
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
PORT=5000
FRONTEND_URL="https://pcg-kansai-judge.jp"
EOF
```

### 3. フロントエンドのビルドとデプロイ

#### 方法1: プロジェクトを `/var/www/Tournament/` に直接配置する場合

```bash
cd /var/www/Tournament/frontend

# 依存関係のインストール
npm install

# 環境変数を設定してビルド
export VITE_BASE_PATH="/Tournament"
export VITE_API_URL="https://pcg-kansai-judge/api"
npm run build

# ビルド結果をルートに移動（distの中身を親ディレクトリに）
cd /var/www/Tournament
sudo rm -rf *.html *.js *.css assets 2>/dev/null || true
sudo cp -r frontend/dist/* .

# 権限の設定
sudo chown -R www-data:www-data /var/www/Tournament
sudo chmod -R 755 /var/www/Tournament
```

#### 方法2: 別の場所にソースコードを置く場合（デプロイスクリプト使用）

```bash
cd /var/www/tcg-tournament-system
chmod +x frontend/deploy.sh
./frontend/deploy.sh
```

#### 方法3: 別の場所にソースコードを置く場合（手動）

```bash
cd /var/www/tcg-tournament-system/frontend

# 依存関係のインストール
npm install

# 環境変数を設定してビルド
export VITE_BASE_PATH="/Tournament"
export VITE_API_URL="https://pcg-kansai-judge/api"
npm run build

# デプロイ先にコピー
sudo rm -rf /var/www/Tournament/*
sudo cp -r dist/* /var/www/Tournament/

# 権限の設定
sudo chown -R www-data:www-data /var/www/Tournament
sudo chmod -R 755 /var/www/Tournament
```

### 4. Nginx設定

**重要**: 複数の設定ファイルが有効な場合、`judge-management-system` に設定を追加することを推奨します。

既存のNginx設定ファイル（`/etc/nginx/sites-available/judge-management-system`）の `server` ブロック内に以下を追加：

**重要**: `location /Tournament` は `location /` より**前に**配置する必要があります。既存のJudge Systemの設定が `location /` で全てをキャッチしている場合、`/Tournament` の設定が無視されます。

```nginx
# /Tournament パスでフロントエンドを配信
# 重要: location / の直前に配置すること

# /Tournament にアクセスしたときに /Tournament/ にリダイレクト
location = /Tournament {
    return 301 /Tournament/;
}

# /Tournament/ でファイルを配信（location / より前に確実に配置）
# 方法1: 通常のprefix location（推奨）
location /Tournament/ {
    root /var/www;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;
    
    # 静的ファイルのキャッシュ設定
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# 方法2: 上記が動作しない場合、^~ 修飾子を使う
# location ^~ /Tournament/ {
#     root /var/www;
#     index index.html;
#     try_files $uri $uri/ /Tournament/index.html;
# }

# この後に location / { ... } を配置

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

# 既存のJudge Systemの設定（location / は最後に配置）
# location / {
#     ...
# }
```

**重要**: 上記の詳細版の設定を使用してください。簡易版（`proxy_set_header` が少ないバージョン）でも動作する可能性はありますが、詳細版の方が以下に対応しています：
- WebSocket接続（必要に応じて）
- より正確なクライアントIPの取得
- HTTPS対応（X-Forwarded-Proto）
- 静的ファイルのキャッシュ最適化

設定を反映：

```bash
# バックアップを取る（推奨）
sudo cp /etc/nginx/sites-available/judge-management-system /etc/nginx/sites-available/judge-management-system.backup

# 設定ファイルを編集
sudo nano /etc/nginx/sites-available/judge-management-system

# 設定をテスト
sudo nginx -t  # 設定ファイルの構文チェック

# Nginxをリロード
sudo systemctl reload nginx
```

**注意**: 複数の設定ファイルが有効な場合（`default` と `judge-management-system` の両方）、`judge-management-system` に追加することを推奨します。`server_name` の設定によって、どちらの設定が適用されるかが決まります。

### 5. バックエンドのデプロイ（同じサーバーにデプロイする場合）

プロジェクトを `/var/www/Tournament/` に直接配置する場合：

```bash
cd /var/www/Tournament/backend

# 依存関係のインストール
npm install

# Prismaクライアントの生成
npx prisma generate

# ビルド
npm run build

# PM2でプロセス管理（推奨）
sudo npm install -g pm2
pm2 start dist/index.js --name tcg-backend
pm2 save
pm2 startup  # システム起動時に自動起動する設定
```

別の場所にソースコードを置く場合：

```bash
cd /var/www/tcg-tournament-system/backend

# 依存関係のインストール
npm install

# Prismaクライアントの生成
npx prisma generate

# ビルド
npm run build

# PM2でプロセス管理（推奨）
sudo npm install -g pm2
pm2 start dist/index.js --name tcg-backend
pm2 save
pm2 startup  # システム起動時に自動起動する設定
```

## 更新手順

コードを更新した場合：

### プロジェクトを `/var/www/Tournament/` に直接配置している場合

```bash
cd /var/www/Tournament

# Git所有権の問題を解決（初回のみ、必要に応じて）
git config --global --add safe.directory /var/www/Tournament

# 最新のコードを取得
git pull

# フロントエンドを再ビルド・デプロイ
cd frontend
npm install
export VITE_BASE_PATH="/Tournament"
export VITE_API_URL="https://pcg-kansai-judge/api"
npm run build

# ビルド結果をルートに移動
cd ..
sudo rm -rf *.html *.js *.css assets 2>/dev/null || true
sudo cp -r frontend/dist/* .
sudo chown -R www-data:www-data /var/www/Tournament

# バックエンドを再起動（変更がある場合）
cd backend
npm install
npm run build
pm2 restart tcg-backend
```

### 別の場所にソースコードを置いている場合

```bash
cd /var/www/tcg-tournament-system

# 最新のコードを取得
git pull

# フロントエンドを再ビルド・デプロイ
cd frontend
npm install
export VITE_BASE_PATH="/Tournament"
export VITE_API_URL="https://pcg-kansai-judge/api"
npm run build
sudo rm -rf /var/www/Tournament/*
sudo cp -r dist/* /var/www/Tournament/
sudo chown -R www-data:www-data /var/www/Tournament

# バックエンドを再起動（変更がある場合）
cd ../backend
npm install
npm run build
pm2 restart tcg-backend
```

## トラブルシューティング

### 404エラーが表示される、またはJudge Systemの画面が表示される

- `/var/www/Tournament/index.html` が存在するか確認: `ls -la /var/www/Tournament/index.html`
- フロントエンドが正しくビルド・配置されているか確認: `ls -la /var/www/Tournament/`
- フロントエンドを再ビルドして配置:
  ```bash
  cd /var/www/Tournament/frontend
  export VITE_BASE_PATH="/Tournament"
  export VITE_API_URL="https://pcg-kansai-judge.jp/api"
  npm run build
  cd /var/www/Tournament
  sudo rm -rf *.html *.js *.css assets 2>/dev/null || true
  sudo cp -r frontend/dist/* .
  sudo chown -R www-data:www-data /var/www/Tournament
  ```
- Nginx設定で `try_files` が正しく設定されているか確認
- Nginxをリロード: `sudo systemctl reload nginx`

### API接続エラー

- バックエンドが起動しているか確認: `pm2 list`
- Nginxの `/api` プロキシ設定が正しいか確認
- バックエンドのCORS設定で `FRONTEND_URL` が正しく設定されているか確認

### 静的ファイルが読み込めない

- `/var/www/Tournament` の権限を確認
- Nginxのエラーログを確認: `sudo tail -f /var/log/nginx/error.log`

### ビルドエラー

- Node.jsのバージョンを確認: `node --version`（18以上が必要）
- `npm install` が正常に完了しているか確認

## セキュリティチェックリスト

- [ ] `.env` ファイルがGitにコミットされていない
- [ ] `JWT_SECRET` が強力なランダム文字列になっている
- [ ] データベースパスワードが強力になっている
- [ ] HTTPSが有効になっている（Let's Encryptなど）
- [ ] ファイル権限が適切に設定されている

