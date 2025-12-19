# フロントエンド用Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci

# アプリケーションコードのコピー
COPY . .

# ビルド
RUN npm run build

# 本番用イメージ
FROM nginx:alpine

# ビルド結果をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx設定ファイル
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

