# 工具管理システム

- `frontend/` … React + Vite の画面
- `backend/` … Express + MySQL の API（詳細は [backend/README.md](backend/README.md)）

## ローカルでの起動

### 1. backend

```bash
cd backend && npm install && cp .env.example .env
```

`.env` の `MYSQL_PASSWORD` と `JWT_SECRET` を設定してから、

```bash
cd backend && npm run init && npm start
```

`npm run init` はスキーマ作成 + 初期データ投入（`frontend/src/data/*.json`）です。
初回のみ実行すれば、以降は `npm start` だけで起動します。

### 2. frontend

```bash
cd frontend && npm install && npm run dev
```

`https://localhost:5173` で開きます（自己署名証明書のため、初回はブラウザの警告を許可してください）。

## 画面と API のつなぎ方

- 画面から API を呼ぶ関数は `frontend/src/api/` にまとまっています
- フロントは `basicSsl()` で HTTPS 起動するため、`http://localhost:4000` を直接呼ぶと
  mixed content でブロックされます。`vite.config.js` の `server.proxy` で `/api` を
  backend に中継しているので、`.env` の `VITE_API_BASE_URL` は `/api` のままにしてください
  （backend のポートを変える場合は `VITE_PROXY_TARGET` で指定できます）
- 起動時に保存済みトークンを確認し、無い・切れている場合はログイン画面
  （`frontend/src/auth/LoginForm.jsx`）を表示します。初期ユーザーは管理者の
  `E-12345` / `password` です（`backend/db/seed.js`）。ログアウトはマイページから

## 画面

| パス | 画面 | 備考 |
| --- | --- | --- |
| `/rent` | 工具を借りる | QR読み取り / 一覧から選択 |
| `/rentlist` | 借りているもの | 返却・期間更新・他の社員へ引き渡し |
| `/tools` | 工具リスト | 状態・点検日・使用履歴の確認と更新 |
| `/mypage` | マイページ | 社員情報、既定の置き場所の設定 |
| `/employees` | 社員一覧 | 管理者のみ追加・編集・削除が可能 |
| `/newtool` | 工具を追加 | 管理者向け。QRコードの発行つき |

## UI の方針（工場内での使用・ユニバーサルデザイン）

`src/index.css` の冒頭に方針をまとめています。要点は次のとおりです。

- 作業用手袋を想定し、操作要素の最小サイズを 64px（主要操作は 72px）に統一
- 立ったまま少し離れて見る前提で基準文字サイズを 20px に設定
- 状態は色だけで伝えず、必ずアイコン（●▲✕）と文字を併記
- 貸出状況はカードの枠線で示す（貸出中=赤 `--color-accent` / 貸出可能=緑 `--color-available`）。
  枠線と併せて「貸出中 / 貸出可能」の文字も必ず出す
- 赤と緑の対比を避け、良好=青 / 不良=橙 / 破損=赤 で色覚特性に配慮
- 画面下部ナビはアイコンだけにせず文字ラベルを併記し、現在地はバーでも表示
- `prefers-reduced-motion` / `prefers-contrast` に追従
- 基準文字サイズは画面幅で切り替え（スマホ 16px / 480px〜 18px / 768px〜 20px）。
  タップ領域は `--spacing-touch`（4rem）なのでどの幅でも 64px 以上を保つ

### 色トークンの命名について

白は `--color-base` ではなく **`--color-surface`** にしています。
`base` という名前にすると Tailwind 標準の文字サイズ `text-base` と衝突し、
`text-base`（1rem のつもり）が「白文字」になって白背景で見えなくなるためです。
白背景は `bg-surface`、暗い背景の上の白文字は `text-surface` を使ってください。

## 初期データ

`frontend/src/data/*.json` が backend のシードデータです（画面はこれを直接読まず、API 経由で取得します）。
内容を変えたいときはこの JSON を編集して `cd backend && npm run seed` を実行してください。
