#!/usr/bin/env bash
# バックアップからデータベースと画像を復元する。
#   使い方: scripts/restore.sh <db_....sql.gz> [images_....tar.gz]
#   docker compose で動かしている環境で、リポジトリのルートから実行する。
# 注意: 今のデータベースの内容は、バックアップの内容で置き換わる（元に戻せない）。
#       実行前に、今の状態も scripts/backup.sh で取っておくこと。
set -euo pipefail

cd "$(dirname "$0")/.."

DB_FILE="${1:-}"
IMAGES_FILE="${2:-}"

if [ -z "$DB_FILE" ] || [ ! -f "$DB_FILE" ]; then
    echo "使い方: scripts/restore.sh <db_....sql.gz> [images_....tar.gz]" >&2
    exit 1
fi
if [ -n "$IMAGES_FILE" ] && [ ! -f "$IMAGES_FILE" ]; then
    echo "画像のバックアップが見つかりません: $IMAGES_FILE" >&2
    exit 1
fi

echo "次の内容で、今のデータを置き換えます。"
echo "  データベース: $DB_FILE"
[ -n "$IMAGES_FILE" ] && echo "  画像        : $IMAGES_FILE"
# 取り違えを防ぐため、確認の文字を入力させる（自動実行するときは RESTORE_CONFIRM=yes）
if [ "${RESTORE_CONFIRM:-}" != "yes" ]; then
    read -r -p "よければ yes と入力してください: " answer
    [ "$answer" = "yes" ] || { echo "中止しました。"; exit 1; }
fi

echo "API を止めています（復元中に書き込まれないようにするため）..."
docker compose stop api

echo "データベースを復元しています..."
gzip -dc "$DB_FILE" | docker compose exec -T db sh -c \
    'exec mysql -u root -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 tool_management'

docker compose start api

if [ -n "$IMAGES_FILE" ]; then
    echo "画像を復元しています..."
    docker compose exec -T api tar -xzf - -C /app < "$IMAGES_FILE"
fi

echo "復元が完了しました。画面にログインして内容を確認してください。"
