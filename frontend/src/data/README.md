# data

このディレクトリの JSON は、フロントの仮データではなく
**backend の初期データ（シード）** として使っています。

- `tools.json` … 工具マスタ
- `rentItems.json` … 初期の貸出中データ
- `inspectionItems.json` … 点検項目の初期値と、割り当てる大項目（`categories`）
- `employee.json` … マイページ表示の元になった社員情報（社員の登録内容は `backend/db/seed.js` の `EMPLOYEES`）

`backend/db/seed.js` がこれらを読み込むので、`npm run seed` で投入される
データを変えたいときはここを編集してください。
画面が参照するのは API（`src/api/`）なので、JSON を直接 import している箇所はありません。
