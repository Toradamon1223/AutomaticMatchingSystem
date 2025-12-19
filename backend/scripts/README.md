# スクリプト一覧

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

