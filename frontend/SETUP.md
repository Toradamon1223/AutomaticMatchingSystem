# フロントエンドセットアップガイド

## 1. 依存関係のインストール

```bash
cd frontend
npm install
```

## 2. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` が開きます。

## 3. ビルド（本番用）

```bash
npm run build
```

ビルド結果は `dist/` ディレクトリに出力されます。

## 4. プレビュー（ビルド結果の確認）

```bash
npm run preview
```

## 環境変数（オプション）

必要に応じて `.env` ファイルを作成：

```env
VITE_API_URL=http://localhost:5000/api
```

バックエンドのURLが異なる場合に設定します。

