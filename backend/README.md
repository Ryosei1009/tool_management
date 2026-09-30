# 工具管理システム backend

Express + MySQL + JWT の API サーバー。構成は `Portfolio/backend` を踏襲しています。

## セットアップ

```bash
cd backend
npm install
cp .env.example .env   # 値を編集（MYSQL_PASSWORD と JWT_SECRET は必須）
npm run init           # スキーマ作成 + 初期データ投入
npm start
```

`npm run init` は `npm run setup`（`db/schema.sql` の実行）と `npm run seed`
（`frontend/src/data/*.json` の投入）をまとめたものです。どちらも `.env` の
接続情報を使うので、`mysql` コマンドが無くても初期化できます。

`KEY_PATH` / `CERT_PATH` を設定すると HTTPS、未設定なら HTTP で起動します。

初期ユーザーは `db/seed.js` の `EMPLOYEES` を参照（パスワードは全員 `password`）。
管理者は `E-12345`（山田 太郎）です。

### 初期データ

`npm run seed` は `frontend/src/data/` の JSON をそのまま投入します。

- `tools.json` … 工具 36 件と、各工具の使用者・期間（貸出中として登録）
- `rentItems.json` … 山田 太郎が借りている 4 件。両方に出てくる工具
  （A1 / B1 / D1 / G5）は 1 件しか貸出を持てないため、こちらを優先します
- 社員は `db/seed.js` の `EMPLOYEES`（`tools.json` の `user` に出てくる 4 名）

## テーブル

| テーブル | 内容 |
| --- | --- |
| `employees` | 社員。`permission` が `管理者` / `一般` |
| `tools` | 工具マスタ。`pin_x` / `pin_y` はマップ上の位置（%） |
| `rentals` | 貸出。`status='renting'` の行が現在の貸出で、返却済みの行が履歴になる |

`rentals.active_tool_id`（生成列）に UNIQUE を張っているため、同じ工具が
同時に二重貸出されることはありません（二重貸出は 409 を返します）。

置き場所（A1〜A9）は `pin_x` / `pin_y` から `utils/map.js` で算出します。
フロントの `src/utils/map.js` と同じ判定なので、区画を変更するときは両方を直してください。

## API

認証が必要なエンドポイントは `Authorization: <token>`（`Bearer <token>` も可）を付けます。

### 認証 `/auth`

| メソッド | パス | 説明 |
| --- | --- | --- |
| POST | `/auth/login` | `{ id, password }` → `{ token, employee }` |
| POST | `/auth/check` | トークンの有効性確認 |

### 工具 `/tools`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/tools/get?keyword=` | - | 工具一覧（貸出中なら使用者・期間つき） |
| GET | `/tools/get/:id` | - | 工具詳細 + 貸出履歴。QR 読み取り後に使う |
| POST | `/tools/upload` | 管理者 | 写真アップロード（multipart, field 名 `image`）→ `{ photoUrl }` |
| POST | `/tools/create` | 管理者 | `{ id, name, category, photoUrl, state, pin, lastInspectionDate }` |
| POST | `/tools/update` | ○ | 指定した項目のみ更新（未指定は現在値を維持） |
| POST | `/tools/delete` | 管理者 | `{ id }` |

### 貸出 `/rentals`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/rentals/mine` | ○ | 借りているものリスト |
| GET | `/rentals/get` | ○ | 貸出中の全件 |
| POST | `/rentals/create` | ○ | 借りる `{ toolId, startDate, endDate, reserved }` |
| POST | `/rentals/return` | ○ | 返す `{ rentalId, state? }` |
| POST | `/rentals/renew` | ○ | 更新 `{ rentalId, startDate?, endDate?, state?, pin? }` |
| POST | `/rentals/transfer` | ○ | 渡す `{ rentalId, toEmployeeId }` |

返却・更新・引き渡しは本人（または管理者）のみ実行できます。

### 社員 `/employees`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/employees/get` | ○ | 社員一覧（貸出中の件数つき。社員一覧画面・「渡す」のユーザー選択で使用） |
| GET | `/employees/me` | ○ | マイページ（社員情報 + 使用履歴） |
| POST | `/employees/create` | 管理者 | 社員追加 |
| POST | `/employees/update` | ○ | 社員情報の更新（権限変更は管理者のみ） |
| POST | `/employees/delete` | 管理者 | 社員削除（貸出中の工具があると 409） |
| POST | `/employees/password` | ○ | パスワード変更（本人 or 管理者） |

### 既定の置き場所（社員ごと）

`employees.default_pin_x` / `default_pin_y` に、社員ごとの「工具を借りるときの
置き場所」を持たせています。`/employees/update` に `defaultPin: { x, y }` を渡すと設定、
`defaultPin: null` を渡すと解除（未指定なら現状維持）。`/employees/me` と
`/employees/get` は `defaultPin` と、そこから求めた区画名 `defaultPlace` を返します。

この既定値は次の2か所で工具の置き場所に反映されます。

- `/rentals/create` … `pin` を渡すとその位置へ工具を移す。借りる画面は既定の置き場所を初期値にする
- `/rentals/transfer` … 渡し先の社員に既定の置き場所があれば、工具をそこへ移す

## レスポンスの形

工具・貸出は、フロントの既存コンポーネントがそのまま使える形で返します。

```json
{
  "id": "A1",
  "name": "ペンチ1",
  "category": "切断工具",
  "photoUrl": "/img/tmp/1.cutter/A1_pench1.jpg",
  "state": "good",
  "pin": { "x": 19, "y": 17 },
  "place": "A1",
  "lastInspectionDate": "2026-06-01",
  "user": "山田 太郎",
  "userId": "E-12345",
  "rentalId": 1,
  "startDate": "6月20日",
  "endDate": "7月5日",
  "rentStart": "2026-06-20",
  "rentEnd": "2026-07-05",
  "reserved": false,
  "isRented": true
}
```

`startDate` / `endDate` は一覧の表示用（`1月2日`）、`rentStart` / `rentEnd` は
`<input type="date">` にそのまま入れられる `YYYY-MM-DD` です。
