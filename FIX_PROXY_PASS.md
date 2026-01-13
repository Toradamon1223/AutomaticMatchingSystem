# 修正手順: Nginxプロキシ設定のポート番号修正

## 問題
Nginxの `/api` プロキシ設定が `http://localhost:3000` になっているが、バックエンドは `http://localhost:5000` で動いています。

## 修正手順

### 1. 設定ファイルをバックアップ

```bash
sudo cp /etc/nginx/conf.d/judge-management-system.conf /etc/nginx/conf.d/judge-management-system.conf.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. 設定ファイルを編集

```bash
sudo nano /etc/nginx/conf.d/judge-management-system.conf
```

### 3. 修正内容

`location /api` ブロック内の `proxy_pass` を以下のように変更：

**変更前:**
```nginx
location /api {
    proxy_pass http://localhost:3000;
    ...
}
```

**変更後:**
```nginx
location /api {
    proxy_pass http://localhost:5000;
    ...
}
```

### 4. 設定を保存して反映

```bash
# 設定の構文チェック
sudo nginx -t

# エラーがなければ、Nginxを再起動
sudo systemctl restart nginx

# 設定が正しく反映されているか確認
sudo grep -A 3 "location /api" /etc/nginx/conf.d/judge-management-system.conf | grep proxy_pass
```

### 5. 動作確認

```bash
# Nginx経由でAPIにアクセス（外部から）
curl https://pcg-kansai-judge.jp/api/health

# またはブラウザで以下にアクセス
# https://pcg-kansai-judge.jp/api/health
```

## ワンライナーで修正（自動化）

以下のコマンドで自動的に修正できます：

```bash
# バックアップを取る
sudo cp /etc/nginx/conf.d/judge-management-system.conf /etc/nginx/conf.d/judge-management-system.conf.backup.$(date +%Y%m%d_%H%M%S) && \
# 3000を5000に置換
sudo sed -i 's|proxy_pass http://localhost:3000;|proxy_pass http://localhost:5000;|g' /etc/nginx/conf.d/judge-management-system.conf && \
# 設定をテスト
sudo nginx -t && \
# Nginxを再起動
sudo systemctl restart nginx && \
echo "✓ 修正完了" && \
# 確認
sudo grep -A 3 "location /api" /etc/nginx/conf.d/judge-management-system.conf | grep proxy_pass
```


