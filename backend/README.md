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

初期ユーザーは `db/seed.js` の `EMPLOYEES` を参照（パスワードは全員 `password`。
ルールを満たさないので、最初のログインで変更を求められます）。

本番では `npm run seed`（サンプルデータで全テーブルを入れ替える）は使わず、
最初の管理者だけを登録します。

```bash
npm run create-admin -- E-0001 "山田 太郎" "Start2026abc"
```

### テスト

```bash
TM_MYSQL_DATABASE=tool_management_test node db/setup.js   # 初回のみ
npm test
```

`test/api.test.js` はテスト用のデータベース（既定は `tool_management_test`）に対して実際に API を呼びます。
テストのたびに中身を消して入れ直すので、普段使うデータベースとは別の名前にしてください。

### 初期データ

`npm run seed` は `frontend/src/data/` の JSON をそのまま投入します。

- `tools.json` … 工具 36 件と、各工具の使用者・期間（貸出中として登録）
- `rentItems.json` … 山田 太郎が借りている 4 件。両方に出てくる工具
  （A1 / B1 / D1 / G5）は 1 件しか貸出を持てないため、こちらを優先します
- 社員は `db/seed.js` の `EMPLOYEES`（`tools.json` の `user` に出てくる 4 名）

## テーブル

| テーブル | 内容 |
| --- | --- |
| `employees` | 社員。`permission` が `管理者` / `班長` / `一般`。`active = 0` は無効化（退職など） |
| `tools` | 工具マスタ。`pin_x` / `pin_y` はマップ上の位置（%）。`inspection_interval_months` は点検の周期、`active = 0` は無効化（廃棄など） |
| `app_settings` | アプリ全体の設定。`map` にマップ画像と区画を JSON で持つ |
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

持ち出し場所は `pin_x` / `pin_y` と、マップの区画（`app_settings` の `map`）から `utils/map.js` で算出します。
区画は管理画面（マップの設定）で変更でき、一度も保存していないときは従来の A1〜A9 を使います。
フロントの `src/utils/map.js` も同じ判定をします（区画の一覧は `/settings/map` で渡す）。

社員・工具は削除しません（`active = 0` にするだけ）。過去の貸出・点検の履歴に名前が残ります。

## 認証と権限

- ログイン以外のすべての API に `Authorization` が必要です（`/health` と `/images` を除く）
- トークン（JWT・30 日）には社員ID と `token_version` だけを入れ、名前・班・権限・有効かどうかは
  リクエストのたびに DB から取ります。無効化・権限の変更はすぐ反映され、パスワードを変えると
  `token_version` が進んで、それまでのトークンは使えなくなります
- パスワードは 8 文字以上・英字と数字を含む・社員ID と同じものは不可（`utils/password.js`）
- 5 回続けて間違えると 15 分ロック（`employees.failed_logins` / `locked_until`）。ロック中は 423 を返します
- `must_change_password = 1` の間（初期パスワード・初期化のあと）は、パスワードの変更以外の API は 403 を返します
- 権限は 管理者 / 班長 / 一般（`utils/roles.js`）。下の表の「認証」が「班長」のものは、管理者と班長が使えます

## 操作ログ

`logs/access-YYYY-MM-DD.log` に 1 リクエスト 1 行（タブ区切り）で残します。

```
日時	社員ID	メソッド	パス	ステータス	時間	IPアドレス
```

リクエストの本文・ヘッダー・検索語は残しません。`LOG_RETENTION_DAYS`（既定 90）日を過ぎたファイルは自動で消します。
以前の `short-log.txt` / `detailed-log.txt`（本文まで残していた）は使わなくなったので、残っていれば削除してください。

## API

認証が必要なエンドポイントは `Authorization: <token>`（`Bearer <token>` も可）を付けます。

### 認証 `/auth`

| メソッド | パス | 説明 |
| --- | --- | --- |
| POST | `/auth/login` | `{ id, password }` → `{ token, mustChangePassword, employee }`。間違いは 401、ロック中は 423 |
| POST | `/auth/check` | トークンの有効性確認 |

### 工具 `/tools`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/tools/get?keyword=&category=&includeInactive=` | ○ | 工具一覧（貸出中なら使用者・期間、予約一覧 `reservations` つき）。`keyword` は全角/半角を区別しない。`includeInactive=1` は無効化した工具も含める（管理者のみ） |
| GET | `/tools/get/:id` | ○ | 工具詳細 + 使用履歴 `history`・予約 `reservations`・点検項目 `inspectionItems`・点検記録 `inspections`・更新履歴 `changeLogs` |
| POST | `/tools/upload` | 管理者 | 写真・マップ画像のアップロード（multipart, field 名 `image`。JPEG / PNG / WebP / GIF、5MB まで）→ `{ photoUrl }` |
| POST | `/tools/create` | 管理者 | `{ id, name, category, photoUrl, state, defectRank, defectNote, pin, purchaseDate, lastInspectionDate, inspectionIntervalMonths, inspectionItemIds }`。`id` は半角の英数字・ハイフン・アンダーバー |
| POST | `/tools/update` | ○ | 渡した項目のみ更新（省略は現在値のまま、`null` / `''` で空にする）。`name` / `category` / `photoUrl` / `purchaseDate` / `inspectionIntervalMonths` / `inspectionItemIds` は管理者のみ。変わった項目は更新履歴に残る |
| POST | `/tools/inspect` | ○ | 点検の記録 `{ toolId, results: [{ itemId, ok }], note, state?, defectRank?, defectNote? }`。最終点検日を今日にする |
| POST | `/tools/delete` | 管理者 | `{ id }` 無効化する（履歴は残る。予約は取り消す）。貸出中は 409 |
| POST | `/tools/restore` | 管理者 | `{ id }` 無効化した工具を元に戻す |

### 貸出 `/rentals`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/rentals/mine?scope=` | ○ | 借りているもの・予約しているもの。`scope=team` で同じ班のメンバーの分 |
| GET | `/rentals/get` | 管理者 | 貸出中・予約中の全件 |
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
| GET | `/employees/get?includeInactive=` | ○ | 社員一覧（貸出中の件数つき。社員一覧画面・「渡す」のユーザー選択で使用）。`includeInactive=1` は無効化した社員も含める（管理者のみ）。ロック中かどうか（`locked`）は解除できる人にだけ返す |
| GET | `/employees/me` | ○ | マイページ（社員情報 + 使用履歴） |
| POST | `/employees/create` | 管理者 | 社員追加。初期パスワードは本人が初回ログインで変更する |
| POST | `/employees/update` | ○ | 社員情報の更新。本人が変えられるのは既定の持ち出し場所と写真だけで、名前・班・権限・血液型は管理者のみ |
| POST | `/employees/delete` | 管理者 | `{ id }` 無効化する（履歴は残る。予約は取り消す）。貸出中の工具があると 409 |
| POST | `/employees/restore` | 管理者 | `{ id }` 無効化した社員を元に戻す |
| POST | `/employees/password` | ○ | 本人：`{ currentPassword, password }` → 新しい `token`。管理者・同じ班の班長：`{ id, password }` で初期化（本人は次のログインで変更） |
| POST | `/employees/unlock` | 班長 | `{ id }` ログインのロックを解除（班長は同じ班のメンバーのみ） |

### お知らせ・ダッシュボード

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/notifications` | ○ | 画面上部に出すお知らせ `[{ id, level, text, to }]`（返却遅れ・今日が返却予定・点検期限・ロック中の社員） |
| GET | `/dashboard` | 班長 | 管理者は全体、班長は自分の班。`rentals` / `overdueRentals` / `lockedEmployees`、管理者には `defects` / `inspectionOverdue` / `inspectionSoon` も返す |

### マップの設定 `/settings`

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/settings/map` | ○ | `{ imageUrl, rows, cols, regions: [{ name, x0, y0, x1, y1 }] }` |
| POST | `/settings/map` | 管理者 | `{ imageUrl?, rows, cols, names }` で縦 × 横の均等な区画にする。`{ reset: true }` で初期の区画に戻す |

### CSV `/csv`（すべて管理者のみ）

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/csv/tools/export` | 工具台帳（無効化した工具も含む） |
| GET | `/csv/rentals/export?from=&to=` | 貸出履歴（開始日で絞り込み） |
| GET | `/csv/inspections/export?from=&to=` | 点検履歴（点検日で絞り込み） |
| GET | `/csv/employees/export` | 社員一覧（取り込みのひな形。パスワードは含まない） |
| POST | `/csv/tools/import?dryRun=` | 工具の一括登録・更新（multipart, field 名 `file`） |
| POST | `/csv/employees/import?dryRun=` | 社員の一括登録・更新（multipart, field 名 `file`） |

出力は UTF-8（BOM つき）+ CRLF。`=` などで始まるセルは、Excel が式として実行しないよう先頭に `'` を付けます。
取り込みは UTF-8 と Shift_JIS に対応し、`dryRun=1` なら内容とエラーの行だけを返します（登録しない）。
1 行でもエラーがあれば何も登録せず、400 と行ごとの結果 `{ committed, summary, rows }` を返します。
ID が登録済みの行は更新、未登録の行は新規登録です。見出しの無い列は変更しません。

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
  "inspectionIntervalMonths": 12,
  "inspection": { "intervalMonths": 12, "nextDate": "2027-06-01", "daysLeft": 202, "status": "ok" },
  "active": true,
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
  "isOverdue": false,
  "isReserved": false
}
```

`startDate` / `endDate` / `takenAt` は表示用、`rentStart` / `rentEnd`（`YYYY-MM-DD`）と
`rentStartPeriod` / `rentEndPeriod`（`am` / `pm`）は入力欄にそのまま入れられる値です。
