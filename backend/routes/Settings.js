const express = require('express');
const router = express.Router();
const db = require('../db/pool').promise;
const { authenticate, requireAdmin } = require('../middleware/auth');
const { MAX_GRID, buildGrid, loadMapConfig, saveMapConfig, DEFAULT_CONFIG } = require('../utils/map');

// マップ（持ち出し場所）の設定。
// 画像と区画（縦 × 横の数・名前）を管理者が変更できる。工具や社員のピンの座標はそのままなので、
// 区画を変えると、同じ位置のピンが新しい区画名で表示される。

// 現在の設定。フロントはこれを使ってピンの位置から区画名を出す。
router.get('/map', authenticate, async (req, res) => {
    res.json(await loadMapConfig(db, { force: true }));
});

// 設定の保存（管理者のみ）。
//   { imageUrl, rows, cols, names }  … 縦 rows × 横 cols の均等な区画にする
//   { imageUrl }                     … 画像だけ差し替える（区画は今のまま）
//   { reset: true }                  … 初期のマップと区画（A1〜A9）に戻す
router.post('/map', authenticate, requireAdmin, async (req, res) => {
    const { imageUrl, rows, cols, names, reset } = req.body;

    try {
        if (reset) return res.json(await saveMapConfig(db, DEFAULT_CONFIG));

        const current = await loadMapConfig(db, { force: true });
        const next = { ...current };

        if (imageUrl !== undefined) {
            // アップロード済みの画像（/images/...）か、未設定（初期の画像）だけを受け付ける
            if (imageUrl !== null && !/^\/images\/[A-Za-z0-9._-]+$/.test(String(imageUrl))) {
                return res.status(400).send('マップ画像の指定が正しくありません。');
            }
            next.imageUrl = imageUrl;
        }

        if (rows !== undefined || cols !== undefined) {
            const r = Number(rows);
            const c = Number(cols);
            const valid = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_GRID;
            if (!valid(r) || !valid(c)) {
                return res.status(400).send(`区画の数は、縦・横とも 1〜${MAX_GRID} で指定してください。`);
            }
            const list = Array.isArray(names) ? names.map((n) => String(n ?? '').trim().slice(0, 16)) : [];
            const regions = buildGrid(r, c, list);
            const unique = new Set(regions.map((g) => g.name));
            if (unique.size !== regions.length) {
                return res.status(400).send('区画の名前が重複しています。区画ごとに違う名前を付けてください。');
            }
            next.rows = r;
            next.cols = c;
            next.regions = regions;
        }

        res.json(await saveMapConfig(db, next));
    } catch (err) {
        console.error(err);
        res.status(500).send('マップの設定を保存できませんでした。');
    }
});

module.exports = router;
