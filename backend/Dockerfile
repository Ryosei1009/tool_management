# 工具管理システム API（Express）
FROM node:22-alpine

ENV NODE_ENV=production TZ=Asia/Tokyo
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# 画像と操作ログは volume に置く（docker-compose.yml）。root 以外のユーザーで動かす。
RUN mkdir -p images logs && chown -R node:node /app
USER node

EXPOSE 4000

# 起動のたびにスキーマを最新にしてから（不足しているテーブル・列だけを追加。データは消さない）起動する
CMD ["sh", "-c", "node db/setup.js && node index.js"]
