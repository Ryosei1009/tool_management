# 運用の手順（本番の設置・バックアップ・復旧）

工具管理システムを社内サーバーやクラウドで動かすための手順です。
画面（nginx）・API（Express）・データベース（MySQL）を Docker でまとめて動かします。

> Docker の構成（`docker-compose.yml`・`Dockerfile`・`nginx.conf`）と `scripts/` は、作成時点では
> 実機での起動確認をしていません。本番に入れる前に、検証用の環境で一度「設置 → バックアップ → 復元」を
> 通して確かめてください。

## 1. 必要なもの

- Docker と Docker Compose が動くサーバー 1 台（Linux を想定）
- HTTPS を付ける手段（社内のリバースプロキシ・ロードバランサーなど）。
  **QR コードの読み取り（カメラ）は HTTPS でしか動きません。**

## 2. 設置

```bash
git clone <このリポジトリ> tool_management && cd tool_management
cp .env.docker.example .env
```

`.env` を開き、次の 3 つを設定します（`.env` は Git に入りません）。

| 項目 | 内容 |
| --- | --- |
| `MYSQL_ROOT_PASSWORD` | MySQL の管理用パスワード |
| `MYSQL_PASSWORD` | アプリが使う MySQL のパスワード |
| `JWT_SECRET` | ログインのトークンに署名する秘密鍵。`openssl rand -hex 32` で作る |

起動します。API は起動のたびにスキーマを最新にします（足りないテーブル・列を追加するだけで、データは消しません）。

```bash
docker compose up -d --build
```

最初の管理者を登録します（初回ログインでパスワードの変更を求められます）。

```bash
docker compose exec api npm run create-admin -- E-0001 "山田 太郎" "Start2026abc"
```

`http://<サーバー>:8080` を前段のリバースプロキシから HTTPS で公開し、ログインできることを確かめます。
ポートは `.env` の `WEB_PORT` で変えられます。

> `npm run seed` はサンプルデータで**全テーブルを入れ替える**ので、本番では実行しないでください。

### 最初に入れるデータ

管理者でログインし、マイページの「管理者メニュー」から行います。

1. **マップの設定** … 工場のマップ画像と、区画の数・名前
2. **CSV の入出力** … 社員と工具を CSV でまとめて登録（先に「今の内容を出力する」でひな形を取れます）
3. **点検項目の管理** … 点検項目と、工具ごとの点検の周期

## 3. バックアップ

`scripts/backup.sh` が、データベースと画像（工具の写真・マップ画像）を `./backups` に保存します。
30 日より古いものは自動で消します（`KEEP_DAYS` で変更）。

```bash
scripts/backup.sh              # ./backups に保存
scripts/backup.sh /mnt/backup  # 保存先を指定
```

毎日 1 回、自動で取る設定の例（cron。毎日 2:30）：

```cron
30 2 * * * cd /opt/tool_management && scripts/backup.sh /mnt/backup >> /var/log/tool_backup.log 2>&1
```

- バックアップには社員の情報が入ります。保存先は他の人から読めない場所にしてください。
- **サーバーとは別の場所**（別のサーバー・NAS・クラウドのストレージ）にも写してください。
  サーバーが壊れると、同じディスクにあるバックアップも一緒に失われます。
- 月に 1 回は、検証用の環境で実際に復元できることを確かめてください。

## 4. 復元

```bash
scripts/restore.sh backups/db_20261111_023000.sql.gz backups/images_20261111_023000.tar.gz
```

- 今のデータベースの内容は、バックアップの内容で**置き換わります**（元に戻せません）。
  実行の前に、今の状態も `scripts/backup.sh` で取っておいてください。
- 復元中は API を止めます（数十秒〜数分、画面が使えなくなります）。
- 画像のバックアップは省略できます（データベースだけを戻す）。

### サーバーが壊れたとき（別のサーバーで復旧する）

1. 新しいサーバーで「2. 設置」の `docker compose up -d --build` まで行う（`.env` の `JWT_SECRET` は新しく作ってよい。全員がログインし直しになるだけ）
2. バックアップのファイルを新しいサーバーに置き、`scripts/restore.sh` で復元する
3. 管理者でログインし、工具と貸出の内容を確かめる

## 5. 更新（新しいバージョンを入れる）

```bash
scripts/backup.sh                 # 念のため、先にバックアップ
git pull
docker compose up -d --build      # スキーマの更新は API の起動時に自動で行われる
```

## 6. ログと監視

| 見たいもの | 場所 |
| --- | --- |
| 操作ログ（いつ・誰が・何をしたか） | `docker compose exec api ls logs/` の `access-YYYY-MM-DD.log` |
| API のエラー | `docker compose logs api` |
| 動いているかの確認 | `curl http://localhost:8080/api/health` が `{"ok":true}` を返す |

操作ログは 1 行が「日時・社員ID・メソッド・パス・結果・時間・IP アドレス」です。
リクエストの中身（パスワードや入力内容）は残しません。`LOG_RETENTION_DAYS`（既定 90 日）を過ぎたものは自動で消えます。

監視を入れるときは、上の `/api/health` を 1〜5 分ごとに確認し、失敗が続いたら知らせる設定にしてください。

## 7. アカウントのトラブル

| 状況 | 対応 |
| --- | --- |
| パスワードを 5 回間違えてロックされた | 15 分待つか、管理者・同じ班の班長が「社員一覧」または「管理ダッシュボード」から解除する |
| パスワードを忘れた | 管理者・同じ班の班長が「社員一覧」の「パスワード初期化」で初期パスワードを決めて本人に伝える（次のログインで変更が必要） |
| 退職した | 管理者が「社員一覧」で「無効化」する。ログインできなくなるが、過去の貸出履歴は残る |
| 管理者が全員ログインできない | サーバーで `docker compose exec api npm run create-admin -- <新しい社員ID> <名前> <初期パスワード>` を実行し、新しい管理者で入る |

## 8. Docker を使わずに動かす

`backend/README.md` の「セットアップ」と、ルートの `README.md` の「ローカルでの起動」を参照してください。
画面は `cd frontend && npm run build` でできる `dist/` を、任意の Web サーバーで配信します。
`/api/` を API に中継する設定は `frontend/nginx.conf` が参考になります。
