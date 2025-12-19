# スクリプト一覧

## test-database-connection.js

データベース接続をテストするスクリプトです。接続エラーが発生した場合に使用します。

### 使い方

```bash
cd backend
node scripts/test-database-connection.js
```

### 機能

- DATABASE_URLの確認（パスワード部分は隠して表示）
- データベースへの接続テスト
- ユーザー数の確認
- Adminユーザーの一覧表示

### 例

```bash
$ node scripts/test-database-connection.js

=== データベース接続テスト ===

DATABASE_URL: postgresql://postgres:***@db.wzktmwufngrdbuxnorqd.supabase.co:5432/postgres?pgbouncer=true

接続を試みています...
✅ 接続成功！

クエリをテストしています...
✅ ユーザー数: 5

✅ Adminユーザーが見つかりました:
   1. 管理者 (admin@example.com)
```

## generate-jwt-secret.js

JWT_SECRETを生成するスクリプトです。

### 使い方

```bash
cd backend
node scripts/generate-jwt-secret.js
```

生成された文字列を`.env`ファイルの`JWT_SECRET`に設定してください。

### 例

```bash
$ node scripts/generate-jwt-secret.js

=== JWT_SECRET生成 ===

以下の文字列を.envファイルのJWT_SECRETに設定してください:

a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2

例:
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2"
```

## reset-admin-password.js

Adminユーザーのパスワードをリセットするスクリプトです。

### 使い方

```bash
cd backend
node scripts/reset-admin-password.js
```

### 実行手順

1. Adminユーザー一覧が表示されます
2. パスワードをリセットするユーザーを選択（複数いる場合）
3. 新しいパスワードを入力
4. パスワードを確認入力

### 例

```bash
$ node scripts/reset-admin-password.js

=== Adminユーザー一覧 ===
1. 管理者 (admin@example.com)

✅ ユーザー "管理者" (admin@example.com) を選択しました

新しいパスワードを入力してください: newpassword123
パスワードを確認してください: newpassword123

✅ パスワードをリセットしました！
   ユーザー: 管理者 (admin@example.com)
   新しいパスワード: newpassword123
```

## make-admin.js

最初のユーザーを管理者にするスクリプトです。

### 使い方

```bash
cd backend
node scripts/make-admin.js
```

## create-test-users.js

テストユーザーを作成するスクリプトです。

### 使い方

```bash
cd backend
node scripts/create-test-users.js
```

## encode-password.js

データベースパスワードをURLエンコードするスクリプトです。パスワードに`@`などの特殊文字が含まれている場合に使用します。

### 使い方

```bash
cd backend
node scripts/encode-password.js
```

### 例

パスワードが`@KusKus1223`の場合：

```bash
$ node scripts/encode-password.js

パスワードを入力してください: @KusKus1223

=== URLエンコード結果 ===

元のパスワード: @KusKus1223
エンコード後: %40KusKus1223

DATABASE_URLの例:
postgresql://postgres:%40KusKus1223@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true

注意: @ は %40 に変換されます
```

### 重要な注意点

- `@`は`%40`に変換されます
- その他の特殊文字（`#`, `%`, `&`, `=`など）も自動的にエンコードされます
- エンコード後の文字列を`DATABASE_URL`の`[PASSWORD]`部分に使用してください

