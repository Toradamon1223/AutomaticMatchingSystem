# 自動化スクリプトガイド

機能追加や変更があった時に、バックエンドサーバーを再起動してPrisma Clientを再生成する自動化スクリプトです。

## 使用方法

### 方法1: npmスクリプト（推奨・クロスプラットフォーム）

```bash
# ルートディレクトリから実行
npm run restart:backend
```

### 方法2: Node.jsスクリプト（推奨・クロスプラットフォーム）

```bash
# バックエンドディレクトリから実行
cd backend
node scripts/restart-with-prisma.js
```

または、npmスクリプト経由：

```bash
cd backend
npm run restart:with-prisma
```

### 方法3: Bashスクリプト（Linux/Mac/サーバー）

```bash
cd backend
chmod +x scripts/restart-with-prisma.sh
./scripts/restart-with-prisma.sh
```

### 方法4: PowerShellスクリプト（Windows）

```powershell
cd backend
.\scripts\restart-with-prisma.ps1
```

## 実行内容

スクリプトは以下の順序で実行されます：

1. **Prisma Clientを再生成**
   - `npm run prisma:generate` を実行
   - データベーススキーマの変更を反映

2. **TypeScriptをビルド**
   - `npm run build` を実行
   - 最新のコードをコンパイル

3. **PM2でサーバーを再起動**（PM2が使用されている場合）
   - `pm2 restart tcg-backend` を試行
   - 失敗した場合は `pm2 restart backend` を試行
   - それも失敗した場合は `pm2 restart all` を試行

## その他の便利なコマンド

### マイグレーション実行

```bash
# ルートディレクトリから
npm run migrate

# または、バックエンドディレクトリから
cd backend
npm run prisma:migrate
```

### Prisma Clientのみ再生成

```bash
# ルートディレクトリから
npm run generate:prisma

# または、バックエンドディレクトリから
cd backend
npm run prisma:generate
```

## 開発環境での使用

開発環境では、通常は `npm run dev` を使用します。このスクリプトは主に本番環境や、スキーマ変更後の再起動に使用します。

## トラブルシューティング

### PM2が見つからない場合

ローカル開発環境ではPM2がインストールされていない場合があります。その場合は、手動でサーバーを再起動してください：

```bash
# 開発モード
npm run dev

# 本番モード
npm start
```

### サーバーが起動していない場合

PM2でサーバーが起動していない場合、スクリプトは警告を表示します。手動で起動してください：

```bash
pm2 start dist/index.js --name tcg-backend
pm2 save
```

