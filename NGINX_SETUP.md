# Nginx設定ファイルの確認方法

## 現在の設定ファイル

以下の3つのファイルがある場合：
- `default`
- `judge-management-system`
- `judge-management-system.save`

## どれが使われているか確認する方法

### 1. sites-enabled を確認（最も確実）

```bash
ls -la /etc/nginx/sites-enabled/
```

シンボリックリンクが作成されているファイルが実際に使われています。

### 2. Nginxの設定をテスト

```bash
sudo nginx -t
```

このコマンドで実際に読み込まれている設定ファイルが表示されます。

### 3. 実際に読み込まれている設定を確認

```bash
sudo nginx -T | grep -E "server_name|listen" | head -20
```

### 4. 各ファイルの内容を確認

```bash
# default の内容
cat /etc/nginx/sites-available/default | grep -E "server_name|listen"

# judge-management-system の内容
cat /etc/nginx/sites-available/judge-management-system | grep -E "server_name|listen"
```

## 推奨：judge-management-system に設定を追加

`judge-management-system` が使われている可能性が高いので、そのファイルに `/Tournament` の設定を追加することを推奨します。

### 設定の追加手順

1. バックアップを取る：
```bash
sudo cp /etc/nginx/sites-available/judge-management-system /etc/nginx/sites-available/judge-management-system.backup
```

2. 設定ファイルを編集：
```bash
sudo nano /etc/nginx/sites-available/judge-management-system
```

3. `server` ブロック内に以下を追加：

```nginx
# /Tournament パスでフロントエンドを配信
location /Tournament {
    alias /var/www/Tournament;
    index index.html;
    try_files $uri $uri/ /Tournament/index.html;
    
    # 静的ファイルのキャッシュ設定
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# APIプロキシ設定
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
```

4. 設定をテスト：
```bash
sudo nginx -t
```

5. Nginxをリロード：
```bash
sudo systemctl reload nginx
```

## トラブルシューティング

### どのファイルが有効かわからない場合

```bash
# 1. sites-enabled を確認
ls -la /etc/nginx/sites-enabled/

# 2. 実際に読み込まれている設定を確認
sudo nginx -T 2>&1 | grep -A 5 "server_name"
```

### 複数の設定ファイルがある場合

通常、`sites-enabled` にシンボリックリンクがあるファイルが優先されます。複数ある場合は、`server_name` や `listen` の設定で判定されます。

