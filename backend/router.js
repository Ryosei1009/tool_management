const express = require('express');
const fs = require('fs');
const path = require('path');

// 既存の API サーバー（Portfolio の api）に組み込めるよう、
// 工具管理の API を 1 つの Router にまとめる（フロントは Vercel で配信）。
//   app.use('/tool', require('<このリポジトリ>/backend/router'));
// とすると /tool/api/... が API になる。
// 単体起動（index.js）では api だけを使う。

const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

const api = express.Router();

api.use(express.json());
api.use('/images', express.static(imagesDir));

api.get('/health', (req, res) => res.json({ ok: true }));

api.use('/auth/', require('./routes/Auth'));
api.use('/tools/', require('./routes/Tools'));
api.use('/rentals/', require('./routes/Rentals'));
api.use('/employees/', require('./routes/Employees'));
api.use('/inspection-items/', require('./routes/InspectionItems'));

api.use((req, res) => res.status(404).send('エンドポイントが見つかりません。'));

// multer のエラーなどをまとめて拾う
api.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).send(err.message || 'サーバーエラーが発生しました。');
});

const router = express.Router();
router.use('/api', api);

module.exports = router;
module.exports.api = api;
