# ビルドスクリプトの使い方

## 推奨方法: npmスクリプト

文字化けを避けるため、**npmスクリプトの使用を推奨**します。

### セットアップ（初回のみ）

```powershell
npm install
```

### ビルド

```powershell
# 順番にビルド（推奨）
npm run build

# 並列でビルド（高速）
npm run build:parallel

# 個別にビルド
npm run build:backend
npm run build:frontend
```

### 開発モード

```powershell
# バックエンドとフロントエンドを並列で起動
npm run dev
```

## その他の方法

### PowerShellスクリプト（文字化けする可能性あり）

```powershell
.\build.ps1
```

**注意**: PowerShellスクリプトは文字エンコーディングの問題で文字化けする可能性があります。npmスクリプトの使用を推奨します。

### Bashスクリプト（Linux/Mac/サーバー）

```bash
chmod +x build.sh
./build.sh
```

