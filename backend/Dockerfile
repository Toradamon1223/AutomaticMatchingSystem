# バックエンド用Dockerfile
FROM node:18-alpine

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci --only=production

# Prismaクライアントの生成
COPY prisma ./prisma
RUN npx prisma generate

# アプリケーションコードのコピー
COPY . .

# TypeScriptのビルド
RUN npm run build

# ポートの公開
EXPOSE 5000

# アプリケーションの起動
CMD ["npm", "start"]

