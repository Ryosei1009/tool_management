# 本番（shinoryo.com の VPS）での動かし方

工具管理の API を、自分の VPS（ConoHa・Ubuntu 24.04）で、ほかのシステムとは別のコンテナとして動かします。
画面は Vercel で配信します。

```
ブラウザ
  ├─ https://tool.shinoryo.com     → Vercel（画面。frontend/）
  └─ https://toolapi.shinoryo.com  → Cloudflare → VPS の Caddy → tool コンテナ（127.0.0.1:4000）
                                                                    └─ MySQL（/srv/infra、DB 名 tool_management）
```

| 置き場所 | 中身 |
|---|---|
| `/srv/tool` | このリポジトリ（git clone）と `.env` |
| `/srv/tool/data/images` | 工具の写真・マップ画像（コンテナの `/app/images`） |
| `/srv/tool/data/logs` | 操作ログ（コンテナの `/app/logs`、90 日で自動削除） |
| `/srv/infra` | Caddy と MySQL（ほかのシステムと共用） |

- 使う構成は `compose.vps.yaml`（API だけ）。`docker-compose.yml`（画面・API・MySQL をまとめて動かす構成）は使わない
- API は `127.0.0.1:4000` だけで待ち受け、外からは Caddy を通してしか届かない
- 画面からの通信は `ALLOWED_ORIGINS`（`https://tool.shinoryo.com`）からだけ受け付ける

## 更新（新しいバージョンを入れる）

```bash
cd /srv/tool && git pull && sudo docker compose -f compose.vps.yaml up -d --build
```

起動のたびに `db/setup.js` が、足りないテーブル・列だけを追加します（データは消しません）。
画面（Vercel）は GitHub に push すると自動で作り直されます。API と画面は同じタイミングで新しくしてください。

## 最初の設置（2026/11 に Portfolio の API から分けたときの手順）

それまでは Portfolio の API（`/srv/portfolio`、`api.shinoryo.com/tool/api`）の中で一緒に動かしていました。

### 0. バックアップを取る

```bash
cd /srv/infra
sudo docker compose exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction tool_management' > ~/tool_management-before-split.sql
sudo tar czf ~/tool-images-before-split.tgz -C /srv/portfolio/app/tool_management/backend images
```

DB 名は Portfolio の `.env` の `TM_MYSQL_DATABASE` の値です（`tool_management` でなければ読み替える）。

### 1. DNS と Vercel

- Cloudflare：`toolapi` の A レコード（VPS の IP、プロキシ ON）
- Vercel：工具管理のプロジェクトの Domains に `tool.shinoryo.com` を追加し、表示された CNAME を Cloudflare に入れる（プロキシ OFF）

### 2. DB のユーザーを作る（Portfolio とは別のユーザー）

```bash
cd /srv/infra
PW=$(openssl rand -base64 24 | tr -d '/+='); echo "$PW"
sudo docker compose exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' <<EOF
CREATE USER 'tool'@'%' IDENTIFIED BY '$PW';
GRANT ALL PRIVILEGES ON tool_management.* TO 'tool'@'%';
EOF
```

表示されたパスワードは、次の `.env` の `MYSQL_PASSWORD` に入れます。

### 3. コードを置いて `.env` を作る

リポジトリは非公開なので、VPS 専用の「読み取りだけできる鍵」（デプロイキー）を作って clone します。
この鍵で読めるのはこのリポジトリだけで、push もできません（VPS が乗っ取られても、ほかのリポジトリは読まれない）。

```bash
# 1. 鍵を作る（パスフレーズは空のまま Enter）
ssh-keygen -t ed25519 -f ~/.ssh/tool_management_deploy -C "vps tool_management"
cat ~/.ssh/tool_management_deploy.pub
```

表示された1行（`ssh-ed25519 ...`）を、GitHub の tool_management の
Settings → Deploy keys → Add deploy key に貼る（「Allow write access」はオフのまま）。

```bash
# 2. このリポジトリのときだけ、この鍵を使うようにする（Task_Manager の鍵と分けるため、Host に別名を付ける）
cat >> ~/.ssh/config <<'CONF'

Host github-tool_management
    HostName github.com
    User git
    IdentityFile ~/.ssh/tool_management_deploy
    IdentitiesOnly yes
CONF
chmod 600 ~/.ssh/config

# 3. clone して .env を作る
sudo mkdir -p /srv/tool && sudo chown $USER:$USER /srv/tool
git clone git@github-tool_management:ShinoChan0/tool_management.git /srv/tool
cd /srv/tool
cp deploy/env.vps.example .env && chmod 600 .env && nano .env
```

- `JWT_SECRET` は Portfolio の `.env` の `TM_JWT_SECRET` と同じ値にすると、ログイン中の人がログインし直さずに済む

### 4. 写真を移して、起動する

```bash
mkdir -p /srv/tool/data/images /srv/tool/data/logs
sudo cp -a /srv/portfolio/app/tool_management/backend/images/. /srv/tool/data/images/
# コンテナの中は node ユーザー（uid 1000）で動くので、書き込めるようにする
sudo chown -R 1000:1000 /srv/tool/data
cd /srv/tool && sudo docker compose -f compose.vps.yaml up -d --build
sudo docker compose -f compose.vps.yaml logs --tail 30
curl -s http://127.0.0.1:4000/health   # {"ok":true} なら OK
```

### 5. Caddy に `toolapi.shinoryo.com` を追加する

`deploy/Caddyfile.toolapi` の中身を `/srv/infra/caddy/Caddyfile` の末尾に追記して、読み込み直します。

```bash
sudo docker exec -w /etc/caddy caddy caddy reload
curl -s https://toolapi.shinoryo.com/health
```

### 6. 画面を新しい API に向ける

`frontend/.env.production` の `VITE_API_BASE_URL` は `https://toolapi.shinoryo.com`。
GitHub に push して Vercel で作り直し、`https://tool.shinoryo.com` でログイン・一覧・写真の表示を確かめます。

### 7. Portfolio から工具管理を外す

Portfolio リポジトリの手順（`deploy/README.md`）に従って、Portfolio のコンテナを作り直します。
そのあと、Portfolio の DB ユーザーから `tool_management` の権限を外します。

### 8. バックアップに入れる

`/srv/infra/scripts/backup.sh` の `--databases` に `tool_management` を、`tar` に `tool/.env` と `tool/data/images` を追加します。
