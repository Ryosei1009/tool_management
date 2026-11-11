#!/usr/bin/env bash
# データベースと画像（工具の写真・マップ画像）のバックアップを取る。
#   使い方: scripts/backup.sh [保存先のフォルダ]     （既定は ./backups）
#   docker compose で動かしている環境で、リポジトリのルートから実行する。
#   毎日 1 回、cron などで実行する想定（docs/operations.md）。
# 保存先には次の 2 つができる。KEEP_DAYS 日（既定 30 日）より古いものは消す。
#   db_YYYYMMDD_HHMMSS.sql.gz      … データベース
#   images_YYYYMMDD_HHMMSS.tar.gz  … 画像
set -euo pipefail

cd "$(dirname "$0")/.."

DEST="${1:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$DEST"
# バックアップには社員の情報が入るので、他のユーザーから読めないようにする
chmod 700 "$DEST"
umask 077

echo "データベースをバックアップしています..."
# --single-transaction … 利用中でも、整合の取れた1時点の内容を取る
docker compose exec -T db sh -c \
    'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces --default-character-set=utf8mb4 tool_management' \
    | gzip > "$DEST/db_$STAMP.sql.gz"

# 途中で失敗して空のファイルができていないか確かめる
if [ "$(gzip -dc "$DEST/db_$STAMP.sql.gz" | head -c 1000 | wc -c)" -lt 100 ]; then
    echo "データベースのバックアップに失敗しました（中身が空です）。" >&2
    rm -f "$DEST/db_$STAMP.sql.gz"
    exit 1
fi

echo "画像をバックアップしています..."
docker compose exec -T api tar -czf - -C /app images > "$DEST/images_$STAMP.tar.gz"

# 古いバックアップを消す
find "$DEST" -maxdepth 1 -type f \( -name 'db_*.sql.gz' -o -name 'images_*.tar.gz' \) -mtime "+$KEEP_DAYS" -delete

echo "完了しました:"
ls -lh "$DEST/db_$STAMP.sql.gz" "$DEST/images_$STAMP.tar.gz"
