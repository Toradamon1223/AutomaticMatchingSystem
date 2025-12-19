# デプロイガイド

このガイドでは、TCG Tournament Systemをサーバーにデプロイする方法を説明します。

## デプロイ方法の選択

### 1. Vercel + Railway（推奨・無料プランあり）

最も簡単で無料で始められる方法です。

#### フロントエンド（Vercel）

1. [Vercel](https://vercel.com/)にアカウントを作成
2. GitHubリポジトリを接続
3. プロジェクト設定：
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. 環境変数を設定：
   - `VITE_API_URL`: バックエンドのURL（例: `https://your-backend.railway.app/api`）
5. デプロイ

#### バックエンド（Railway）

1. [Railway](https://railway.app/)にアカウントを作成
2. GitHubリポジトリを接続
3. 新しいプロジェクトを作成 → 「Deploy from GitHub repo」を選択
4. リポジトリを選択し、**Root Directory**を`backend`に設定
5. 環境変数を設定：
   - `DATABASE_URL`: Supabaseの接続文字列
   - `JWT_SECRET`: 長いランダム文字列
   - `PORT`: `5000`（Railwayが自動設定する場合は不要）
6. デプロイ後、生成されたURLをコピー
7. Vercelの環境変数`VITE_API_URL`を更新

### 2. Docker Compose（VPSや自前サーバー）

#### 前提条件

- Docker と Docker Compose がインストールされていること
- サーバーにSSHアクセスできること

#### 手順

1. サーバーにプロジェクトをクローン：
   ```bash
   git clone <your-repo-url>
   cd tcg-tournament-system
   ```

2. 環境変数ファイルを作成：
   ```bash
   # backend/.env
   DATABASE_URL="postgresql://..."
   JWT_SECRET="your-secret-key"
   PORT=5000
   ```

   ```bash
   # .env（ルートディレクトリ）
   DATABASE_URL="postgresql://..."
   JWT_SECRET="your-secret-key"
   VITE_API_URL="http://your-server-ip:5000/api"
   ```

3. Docker Composeで起動：
   ```bash
   docker-compose up -d
   ```

4. フロントエンドにアクセス: `http://your-server-ip`

### 3. 手動デプロイ（VPS）

#### バックエンド

1. サーバーにNode.js 18以上をインストール
2. プロジェクトをクローン：
   ```bash
   git clone <your-repo-url>
   cd tcg-tournament-system/backend
   ```

3. 依存関係をインストール：
   ```bash
   npm install
   npx prisma generate
   ```

4. 環境変数を設定（`.env`ファイル）
5. ビルド：
   ```bash
   npm run build
   ```

6. PM2などでプロセス管理：
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name tcg-backend
   pm2 save
   pm2 startup
   ```

#### フロントエンド

1. ビルド：
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. `dist`ディレクトリをNginxなどで配信：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /path/to/tcg-tournament-system/frontend/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api {
           proxy_pass http://localhost:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 環境変数の設定

### フロントエンド

- `VITE_API_URL`: バックエンドAPIのURL（例: `https://api.example.com/api`）

### バックエンド

- `DATABASE_URL`: PostgreSQL接続文字列（Supabaseの場合）
- `JWT_SECRET`: JWTトークンの署名用シークレット（長いランダム文字列）
- `PORT`: サーバーのポート番号（デフォルト: 5000）

## トラブルシューティング

### CORSエラー

バックエンドの`src/index.ts`でCORS設定を確認：
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
```

### データベース接続エラー

- Supabaseの接続文字列が正しいか確認
- ファイアウォール設定でSupabaseからの接続を許可しているか確認

### ビルドエラー

- Node.jsのバージョンが18以上であることを確認
- `npm install`が正常に完了しているか確認
- Prismaのマイグレーションが適用されているか確認

## 本番環境のセキュリティチェックリスト

- [ ] `JWT_SECRET`を長いランダム文字列に変更
- [ ] データベースパスワードを強力なものに変更
- [ ] HTTPSを有効化（Let's Encryptなど）
- [ ] 環境変数が適切に設定されている
- [ ] `.env`ファイルがGitにコミットされていない
- [ ] CORS設定が適切に制限されている

