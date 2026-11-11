const express = require('express');
const fs = require('fs');
const path = require('path');
const { accessLog } = require('./utils/accessLog');

// 工具管理の API を 1 つの Router にまとめる。
// 単体起動（index.js）では api だけを使う（本番もこちら。docs/vps.md）。
// ほかの Express のサーバーに組み込むときは
//   app.use('/tool', require('<このリポジトリ>/backend/router'));
// とすると /tool/api/... が API になる（2026/11 までは Portfolio の API にこの形で組み込んでいた）。

const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

const api = express.Router();

// 操作ログ（いつ・誰が・何をしたか）。組み込み先でも残るよう Router 側に置く。
api.use(accessLog);

// アップロードされたファイルを、ブラウザが中身から別の形式と判断して実行しないようにする
api.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

api.use(express.json({ limit: '200kb' }));
// 壊れた JSON は 400 で返す（そのままだと 500 になる）
api.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).send('リクエストの形式が正しくありません。');
    if (err?.type === 'entity.too.large') return res.status(413).send('リクエストが大きすぎます。');
    next(err);
});

// 工具の写真・マップ画像。<img> で読むため認証は付けていない（ファイル名は推測しにくい乱数入り）。
api.use('/images', express.static(imagesDir, { index: false, dotfiles: 'deny' }));

api.get('/health', (req, res) => res.json({ ok: true }));

api.use('/auth/', require('./routes/Auth'));
api.use('/tools/', require('./routes/Tools'));
api.use('/rentals/', require('./routes/Rentals'));
api.use('/employees/', require('./routes/Employees'));
api.use('/inspection-items/', require('./routes/InspectionItems'));
api.use('/settings/', require('./routes/Settings'));
api.use('/csv/', require('./routes/Csv'));
api.use('/', require('./routes/Overview'));

api.use((req, res) => res.status(404).send('エンドポイントが見つかりません。'));

// multer のエラーなどをまとめて拾う
api.use((err, req, res, next) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).send('ファイルが大きすぎます（5MB まで）。');
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    // 想定外のエラーの中身（SQL など）は画面に出さない
    res.status(status).send(status >= 500 ? 'サーバーエラーが発生しました。' : err.message);
});

const router = express.Router();
router.use('/api', api);

module.exports = router;
module.exports.api = api;
