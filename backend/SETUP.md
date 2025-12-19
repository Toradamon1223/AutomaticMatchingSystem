# バックエンドセットアップガイド

## 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/)にアクセスしてアカウントを作成
2. 新しいプロジェクトを作成
3. 接続文字列の取得方法（以下のいずれか）：
   - **方法1**: プロジェクトのホームページで「Connect」ボタンをクリック → 「Database」タブ → 「Connection string」をコピー
   - **方法2**: 「Settings」→「Database」→ ページ上部の「Connection string」タブをクリック
   - **方法3**: 手動で構築（下記参照）

### 接続文字列の手動構築

プロジェクト参照IDとパスワードが分かっている場合、以下の形式で手動で構築できます：

```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

- `[PASSWORD]`: プロジェクト作成時に設定したデータベースパスワード（`@`が含まれる場合は`%40`にエンコード）
- `[PROJECT-REF]`: プロジェクト参照ID（URLの`/project/[PROJECT-REF]/`部分から取得可能）

**例**: プロジェクト参照IDが`vygxnejrjsrfyaklkgid`、パスワードが`@KusKus1223`の場合：
```
postgresql://postgres:%40KusKus1223@db.vygxnejrjsrfyaklkgid.supabase.co:5432/postgres
```

## 2. 環境変数の設定

```bash
cd backend
cp .env.example .env
```

`.env`ファイルを編集して、以下を設定：

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true"
JWT_SECRET="your-very-long-random-secret-key-here"
PORT=5000
```

**重要**: 
- `[YOUR-PASSWORD]`をSupabaseプロジェクト作成時に設定したパスワードに置き換え
- `[PROJECT-REF]`をSupabaseプロジェクトの参照IDに置き換え
- `JWT_SECRET`は長いランダム文字列に変更（本番環境では必ず変更）

### JWT_SECRETの生成方法

以下のコマンドでランダムなJWT_SECRETを生成できます：

```bash
# Node.jsを使用
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# または、PowerShellを使用（Windows）
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# または、OpenSSLを使用（Linux/Mac）
openssl rand -hex 64
```

生成された文字列を`.env`ファイルの`JWT_SECRET`に設定してください。

## 3. 依存関係のインストール

```bash
npm install
```

## 4. Prismaのセットアップ

```bash
# Prismaクライアントを生成
npx prisma generate

# データベースにマイグレーションを実行
npx prisma migrate dev --name init
```

## 5. サーバーの起動

```bash
# 開発モード（ホットリロード有効）
npm run dev

# 本番モード
npm run build
npm start
```

## データベーススキーマ

データベーススキーマは `prisma/schema.prisma` に定義されています。

主なテーブル：
- `users` - ユーザー情報
- `tournaments` - 大会情報
- `participants` - 参加者情報
- `matches` - 対戦情報

## Prisma Studio（データベースGUI）

データベースの内容を確認・編集する場合：

```bash
npx prisma studio
```

ブラウザで `http://localhost:5555` が開きます。

## ユーティリティスクリプト

### Adminユーザーのパスワードリセット

パスワードを忘れた場合、以下のスクリプトでリセットできます：

```bash
cd backend
node scripts/reset-admin-password.js
```

実行すると、Adminユーザー一覧が表示され、パスワードをリセットするユーザーを選択できます。

### その他のスクリプト

- `scripts/make-admin.js` - 最初のユーザーを管理者にする
- `scripts/create-test-users.js` - テストユーザーを作成する

詳細は `backend/scripts/README.md` を参照してください。

