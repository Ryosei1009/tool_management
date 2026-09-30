const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const db = require('../db/pool').promise;
const { authenticate, requireAdmin } = require('../middleware/auth');
const { toToolResponse, toIsoDate } = require('../utils/format');

// 工具写真のアップロード先（router.js で /images として静的配信）。
// 既存 API に組み込むと cwd が変わるので __dirname 基準にする。
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../images')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!/^image\//.test(file.mimetype)) return cb(new Error('画像ファイルのみアップロードできます。'));
        cb(null, true);
    },
});

// 貸出中の情報を付けて工具を取得する共通 SELECT
const TOOL_SELECT = `
    SELECT t.*,
           r.id         AS rental_id,
           r.start_date, r.end_date, r.reserved,
           e.id         AS user_id,
           e.name       AS user_name
      FROM tools t
      LEFT JOIN rentals r  ON r.tool_id = t.id AND r.status = 'renting'
      LEFT JOIN employees e ON e.id = r.employee_id
`;

// 工具一覧（工具リスト画面 / 借りる画面の検索）
// ?keyword= で名前・ID・使用者・場所を絞り込む
router.get('/get', async (req, res) => {
    try {
        const [rows] = await db.query(`${TOOL_SELECT} ORDER BY t.id`);
        let tools = rows.map(toToolResponse);

        const keyword = (req.query.keyword ?? '').trim();
        if (keyword) {
            tools = tools.filter((t) =>
                [t.name, t.id, t.user, t.place, t.category].some((v) => (v ?? '').includes(keyword))
            );
        }
        res.json(tools);
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 工具詳細（QR読み取り / 詳細モーダル）。貸出履歴も返す。
router.get('/get/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`${TOOL_SELECT} WHERE t.id = ?`, [req.params.id]);
        if (rows.length === 0) return res.status(404).send('該当する工具がありません。');

        const [history] = await db.query(
            `SELECT r.start_date, r.end_date, r.status, e.name AS user_name
               FROM rentals r
               JOIN employees e ON e.id = r.employee_id
              WHERE r.tool_id = ?
              ORDER BY r.start_date DESC, r.id DESC
              LIMIT 50`,
            [req.params.id]
        );

        res.json({
            ...toToolResponse(rows[0]),
            history: history.map((h) => ({
                start: toIsoDate(h.start_date),
                end: toIsoDate(h.end_date),
                user: h.user_name,
                status: h.status,
            })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 工具写真のアップロード。保存先URLを返す（工具追加/更新の前に呼ぶ）
router.post('/upload', authenticate, requireAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('画像が選択されていません。');
    res.json({ photoUrl: `/images/${req.file.filename}` });
});

// 工具追加（管理者のみ）
router.post('/create', authenticate, requireAdmin, async (req, res) => {
    const { id, name, category, photoUrl, state, pin, lastInspectionDate } = req.body;
    if (!id || !name) return res.status(400).send('IDと名前は必須です。');

    try {
        await db.query(
            `INSERT INTO tools (id, name, category, photo_url, state, pin_x, pin_y, last_inspection_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                name,
                category ?? null,
                photoUrl ?? null,
                state ?? 'good',
                pin?.x ?? null,
                pin?.y ?? null,
                lastInspectionDate || null,
            ]
        );
        res.status(201).json({ id });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('そのIDの工具は既に登録されています。');
        console.error(err);
        res.status(500).send('工具の追加に失敗しました。');
    }
});

// 工具情報の更新（状態・置き場所のピンなど）
router.post('/update', authenticate, async (req, res) => {
    const { id, name, category, photoUrl, state, pin, lastInspectionDate } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');

    try {
        const [result] = await db.query(
            `UPDATE tools
                SET name = COALESCE(?, name),
                    category = COALESCE(?, category),
                    photo_url = COALESCE(?, photo_url),
                    state = COALESCE(?, state),
                    pin_x = COALESCE(?, pin_x),
                    pin_y = COALESCE(?, pin_y),
                    last_inspection_date = COALESCE(?, last_inspection_date)
              WHERE id = ?`,
            [
                name ?? null,
                category ?? null,
                photoUrl ?? null,
                state ?? null,
                pin?.x ?? null,
                pin?.y ?? null,
                lastInspectionDate || null,
                id,
            ]
        );
        if (result.affectedRows === 0) return res.status(404).send('該当する工具がありません。');
        res.json({ id });
    } catch (err) {
        console.error(err);
        res.status(500).send('工具の更新に失敗しました。');
    }
});

// 工具削除（管理者のみ）
router.post('/delete', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        // rentals.tool_id は ON DELETE RESTRICT なので貸出履歴を先に消す
        await conn.query('DELETE FROM rentals WHERE tool_id = ?', [id]);
        const [result] = await conn.query('DELETE FROM tools WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).send('該当する工具がありません。');
        }
        await conn.commit();
        res.json({ id });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('工具の削除に失敗しました。');
    } finally {
        conn.release();
    }
});

module.exports = router;
