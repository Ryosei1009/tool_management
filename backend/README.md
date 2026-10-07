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

### 既存の DB の更新

`npm run setup` は何度実行してもよく、既存のデータは消しません。`schema.sql` に無いテーブルを作り、
`db/setup.js` の `ADDED_COLUMNS` / `MODIFIED_COLUMNS` で不足している列の追加・定義の変更をします。
列を増やしたときは `schema.sql` と `ADDED_COLUMNS` の両方に書いてください。

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
| `rentals` | 貸出・予約。`status` は `reserved`（予約）/ `renting`（貸出中）/ `returned`（返却済み）/ `cancelled`（予約取消） |
| `inspection_items` | 点検項目マスタ |
| `tool_inspection_items` | 工具ごとの点検項目の割り当て |
| `inspections` / `inspection_results` | 点検の記録と項目ごとの結果（項目名は記録時点のものを写して持つ） |
| `tool_change_logs` | 工具情報の更新履歴。`changes` は `[{ label, from, to }]` の JSON |

`rentals.active_tool_id`（生成列）に UNIQUE を張っているため、同じ工具が
同時に二重貸出されることはありません（二重貸出は 409 を返します）。

期間は「日付 + 午前/午後」（`start_date` + `start_period`、`end_date` + `end_period`）の半日単位で持ちます。
実際の持ち出し・返却は `taken_at` / `returned_at` に日時で記録し、操作した社員を `taken_by` / `returned_by` に残します
（代理で操作したときは `employee_id` と異なる）。現在時刻は DB やサーバーのタイムゾーンによらず日本時間で求めます（`utils/time.js`）。

予約・貸出の期間は、同じ工具の他の予約・貸出と重なると 409 になります。返却予定を過ぎた貸出は、
返却されるまで現在まで続いているものとして扱います。

持ち出し場所（A1〜A9）は `pin_x` / `pin_y` から `utils/map.js` で算出します。
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
| GET | `/tools/get?keyword=&category=` | - | 工具一覧（貸出中なら使用者・期間、予約一覧 `reservations` つき）。`keyword` は全角/半角を区別しない |
| GET | `/tools/get/:id` | - | 工具詳細 + 使用履歴 `history`・予約 `reservations`・点検項目 `inspectionItems`・点検記録 `inspections`・更新履歴 `changeLogs` |
| POST | `/tools/upload` | 管理者 | 写真アップロード（multipart, field 名 `image`）→ `{ photoUrl }` |
| POST | `/tools/create` | 管理者 | `{ id, name, category, photoUrl, state, defectRank, defectNote, pin, purchaseDate, lastInspectionDate, inspectionItemIds }` |
| POST | `/tools/update` | ○ | 渡した項目のみ更新（省略は現在値のまま、`null` / `''` で空にする）。`name` / `category` / `photoUrl` / `purchaseDate` / `inspectionItemIds` は管理者のみ。変わった項目は更新履歴に残る |
| POST | `/tools/inspect` | ○ | 点検の記録 `{ toolId, results: [{ itemId, ok }], note, state?, defectRank?, defectNote? }`。最終点検日を今日にする |
| POST | `/tools/delete` | 管理者 | `{ id }` |

### 貸出 `/rentals`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/rentals/mine?scope=` | ○ | 借りているもの・予約しているもの。`scope=team` で同じ班のメンバーの分 |
| GET | `/rentals/get` | ○ | 貸出中・予約中の全件 |
| POST | `/rentals/create` | ○ | 借りる `{ toolId, mode: 'rent', endDate, endPeriod, pin?, employeeId? }` / 予約 `{ toolId, mode: 'reserve', startDate, startPeriod, endDate, endPeriod, employeeId? }` |
| POST | `/rentals/start` | ○ | 予約していた工具を持ち出す `{ rentalId, endDate?, endPeriod?, pin? }` |
| POST | `/rentals/cancel` | ○ | 予約の取り消し `{ rentalId }` |
| POST | `/rentals/return` | ○ | 返す `{ rentalId, state?, defectRank?, defectNote? }` |
| POST | `/rentals/renew` | ○ | 更新 `{ rentalId, endDate?, endPeriod?, state?, defectRank?, defectNote?, pin? }`（予約なら `startDate` / `startPeriod` も） |
| POST | `/rentals/transfer` | ○ | 渡す `{ rentalId, toEmployeeId }` |

`*Period` は `am`（午前）/ `pm`（午後）。今すぐ借りる（`mode: 'rent'`）ときの開始は現在時刻で、
借りる人自身の予約と重なっていれば、その予約が貸出に切り替わります。

`employeeId` を渡すとその社員の代理で借ります。代理での操作（借りる・返す・延長・予約・引き渡し）は
本人・同じ班（`team` が同じ）のメンバー・管理者のみ実行できます。

### 点検項目 `/inspection-items`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/inspection-items/get` | ○ | 一覧（使っている工具の数 `toolCount` つき） |
| POST | `/inspection-items/create` | 管理者 | `{ name, categories? }`。`categories` の大項目の工具すべてに割り当てる |
| POST | `/inspection-items/update` | 管理者 | `{ id, name?, sortOrder? }` |
| POST | `/inspection-items/reorder` | 管理者 | `{ ids }` の順に並べ直す |
| POST | `/inspection-items/delete` | 管理者 | `{ id }`（過去の点検記録は残る） |

### 社員 `/employees`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/employees/get` | ○ | 社員一覧（貸出中の件数つき。社員一覧画面・「渡す」のユーザー選択で使用） |
| GET | `/employees/me` | ○ | マイページ（社員情報 + 使用履歴） |
| POST | `/employees/create` | 管理者 | 社員追加 |
| POST | `/employees/update` | ○ | 社員情報の更新（権限変更は管理者のみ） |
| POST | `/employees/delete` | 管理者 | 社員削除（貸出中の工具があると 409） |
| POST | `/employees/password` | ○ | パスワード変更（本人 or 管理者） |

### 既定の持ち出し場所（社員ごと）

`employees.default_pin_x` / `default_pin_y` に、社員ごとの「工具を借りるときの
持ち出し場所」を持たせています。`/employees/update` に `defaultPin: { x, y }` を渡すと設定、
`defaultPin: null` を渡すと解除（未指定なら現状維持）。`/employees/me` と
`/employees/get` は `defaultPin` と、そこから求めた区画名 `defaultPlace` を返します。

この既定値は次の3か所で工具の持ち出し場所に反映されます。

- `/rentals/create` … `pin` を渡すとその位置へ工具を移す。借りる画面は既定の持ち出し場所を初期値にする
- `/rentals/start` … 予約を持ち出すとき、`pin` が無ければ借りる人の既定の持ち出し場所へ移す
- `/rentals/transfer` … 渡し先の社員に既定の持ち出し場所があれば、工具をそこへ移す

## レスポンスの形

工具・貸出は、フロントの既存コンポーネントがそのまま使える形で返します。

```json
{
  "id": "A1",
  "name": "ペンチ1",
  "category": "切断工具",
  "photoUrl": "/img/tmp/1.cutter/A1_pench1.jpg",
  "state": "bad",
  "defectRank": "repair",
  "defectNote": "刃先が欠けて細い線が切りにくい。",
  "pin": { "x": 19, "y": 17 },
  "place": "A1",
  "purchaseDate": "2019-04-01",
  "lastInspectionDate": "2026-06-01",
  "user": "山田 太郎",
  "userId": "E-12345",
  "rentalId": 1,
  "rentalStatus": "renting",
  "startDate": "10月7日 午前",
  "endDate": "10月14日 午後",
  "rentStart": "2026-10-07",
  "rentStartPeriod": "am",
  "rentEnd": "2026-10-14",
  "rentEndPeriod": "pm",
  "takenAt": "10月7日 9:05",
  "takenBy": "山田 太郎",
  "isRented": true,
  "isReserved": false
}
```

`startDate` / `endDate` / `takenAt` は表示用、`rentStart` / `rentEnd`（`YYYY-MM-DD`）と
`rentStartPeriod` / `rentEndPeriod`（`am` / `pm`）は入力欄にそのまま入れられる値です。
