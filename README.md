# TCG Tournament System

TCG大会用自動対戦マッチングシステム（PWA対応）

## 機能概要

- ユーザーアカウント管理
- QRコードによるチェックイン
- スイスドロー形式の予選
- オポネント方式による順位決定
- 決勝トーナメント（4, 8, 16, 32人）
- 大会管理機能（開催者・管理者）

## 技術スタック

### フロントエンド
- React 18
- TypeScript
- Vite
- React Router
- Zustand
- PWA対応（vite-plugin-pwa）

### バックエンド
- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- JWT認証

## セットアップ

### 前提条件
- Node.js 18以上
- npm または yarn
- Supabaseアカウント（データベース用）

### データベーススキーマ

データベーススキーマは **`backend/prisma/schema.prisma`** に定義されています。

主なテーブル：
- `users` - ユーザー情報（役割: USER, ORGANIZER, ADMIN）
- `tournaments` - 大会情報
- `participants` - 参加者情報（予選・トーナメント成績）
- `matches` - 対戦情報

### バックエンドのセットアップ

詳細は [backend/SETUP.md](./backend/SETUP.md) を参照してください。

**簡易手順：**

1. Supabaseプロジェクトを作成
2. 環境変数を設定：
   ```bash
   cd backend
   cp .env.example .env
   # .envファイルを編集
   ```
3. 依存関係のインストールとマイグレーション：
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   ```
4. サーバー起動：
   ```bash
   npm run dev
   ```

### フロントエンドのセットアップ

詳細は [frontend/SETUP.md](./frontend/SETUP.md) を参照してください。

**簡易手順：**

```bash
cd frontend
npm install
npm run dev
```

## 環境変数

### バックエンド (.env)

Supabaseを使用する場合：

```env
# Supabase接続文字列（Settings → Database から取得）
DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true"
JWT_SECRET="your-very-long-random-secret-key-here"
PORT=5000
```

**重要**: 
- `[PASSWORD]`をSupabaseプロジェクトのパスワードに置き換え
- `[PROJECT-REF]`をSupabaseプロジェクトの参照IDに置き換え
- `JWT_SECRET`は本番環境で必ず長いランダム文字列に変更

## プロジェクト構造

```
tcg-tournament-system/
├── frontend/          # React フロントエンド
│   ├── src/
│   │   ├── api/      # API クライアント
│   │   ├── pages/    # ページコンポーネント
│   │   ├── stores/   # Zustand ストア
│   │   └── types/    # TypeScript 型定義
│   └── package.json
├── backend/           # Express バックエンド
│   ├── src/
│   │   ├── routes/   # API ルート
│   │   ├── services/ # ビジネスロジック
│   │   ├── middleware/ # ミドルウェア
│   │   └── utils/    # ユーティリティ
│   ├── prisma/
│   │   └── schema.prisma  # データベーススキーマ（ここ！）
│   ├── SETUP.md      # セットアップガイド
│   └── package.json
├── frontend/          # React フロントエンド
│   ├── SETUP.md      # セットアップガイド
└── README.md
```

## 主な機能

### ユーザー機能
- アカウント作成・ログイン
- 大会一覧表示
- QRコードチェックイン
- 対戦情報確認
- 勝敗結果登録

### 開催者機能
- 大会作成（ロゴ画像、会場情報、参加費など）
- 大会開始
- マッチング生成
- 再マッチング
- 勝ち点修正
- 棄権処理

### 管理者機能
- 全機能へのアクセス
- ユーザー管理
- 役割変更

## 自動化スクリプト

機能追加や変更があった時に、バックエンドサーバーを再起動してPrisma Clientを再生成する自動化スクリプトがあります。

### バックエンド再起動（Prisma Client再生成含む）

```bash
# ルートディレクトリから実行（推奨）
npm run restart:backend

# または、バックエンドディレクトリから
cd backend
npm run restart:with-prisma
```

詳細は [`README_AUTOMATION.md`](./README_AUTOMATION.md) を参照してください。

## オポネント方式の順位決定

1. 累計得点（勝利=3P、負け=0P、引き分け=1P）
2. OMW%（対戦相手の勝率）
3. 勝手累点（ゲームウィン）
4. 平均OMW%

## デプロイ

詳細なデプロイ手順は [DEPLOY.md](./DEPLOY.md) を参照してください。

### クイックスタート（Vercel + Railway）

**フロントエンド（Vercel）:**
1. [Vercel](https://vercel.com/)でGitHubリポジトリを接続
2. Root Directory: `frontend` を設定
3. 環境変数 `VITE_API_URL` を設定（バックエンドURL）

**バックエンド（Railway）:**
1. [Railway](https://railway.app/)でGitHubリポジトリを接続
2. Root Directory: `backend` を設定
3. 環境変数を設定:
   - `DATABASE_URL`: Supabase接続文字列
   - `JWT_SECRET`: ランダム文字列
   - `FRONTEND_URL`: フロントエンドURL

### Docker Compose

```bash
# 環境変数を設定後
docker-compose up -d
```

## ライセンス

MIT

