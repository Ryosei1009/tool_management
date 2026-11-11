# 工具管理システム 画面（React をビルドして nginx で配信）
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# API は同じホストの /api で受けて、nginx が backend に中継する（nginx.conf）
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
