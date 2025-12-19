# Nginx設定のトラブルシューティング

## 問題: `/Tournament` にアクセスするとJudge Systemのログイン画面が表示される

### 原因

既存のJudge Systemの設定で `location /` が全てのパスをキャッチしている可能性があります。

### 解決方法

**重要**: Nginxでは、より具体的なlocation（`/Tournament`）を、より一般的なlocation（`/`）より**前に**配置する必要があります。

#### 1. 現在の設定を確認

```bash
# judge-management-system の設定を確認
sudo cat /etc/nginx/sites-available/judge-management-system | grep -A 5 "location"
```

#### 2. 設定の順序を確認

`location /Tournament` が `location /` より**前に**配置されている必要があります。

#### 3. 正しい設定例

```nginx
server {
    listen 80;
    server_name pcg-kansai-judge.jp;
    
    # 重要: /Tournament を / より前に配置
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
    
    # APIプロキシ設定（/Tournamentより前に配置）
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
    
    # Judge Systemの設定（最後に配置）
    location / {
        # 既存のJudge Systemの設定
        ...
    }
}
```

#### 4. 設定を反映

```bash
# 設定ファイルを編集
sudo nano /etc/nginx/sites-available/judge-management-system

# 設定をテスト
sudo nginx -t

# Nginxをリロード
sudo systemctl reload nginx
```

#### 5. 確認

```bash
# /Tournament の設定が正しく読み込まれているか確認
sudo nginx -T | grep -A 10 "location /Tournament"

# ファイルが存在するか確認
ls -la /var/www/Tournament/index.html
```

### その他の確認事項

1. **ファイルの配置確認**
   ```bash
   ls -la /var/www/Tournament/
   # index.html と assets/ ディレクトリが存在することを確認
   ```

2. **権限の確認**
   ```bash
   ls -la /var/www/Tournament/
   # www-data ユーザーが読み取り可能であることを確認
   ```

3. **Nginxエラーログの確認**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

