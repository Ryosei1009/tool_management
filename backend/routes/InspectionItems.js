const express = require('express');
const router = express.Router();
const db = require('../db/pool').promise;
const { authenticate, requireAdmin } = require('../middleware/auth');

// 点検項目マスタ。追加・変更・削除は管理者のみ（管理画面「点検項目の管理」）。
// 工具ごとにどの項目を使うかは /tools/create・/tools/update の inspectionItemIds で設定する。

// 一覧（使っている工具の数つき）
router.get('/get', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT i.id, i.name, i.sort_order, COUNT(ti.tool_id) AS tool_count
               FROM inspection_items i
               LEFT JOIN tool_inspection_items ti ON ti.item_id = i.id
              GROUP BY i.id
              ORDER BY i.sort_order, i.id`
        );
        res.json(
            rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order, toolCount: Number(r.tool_count) }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 追加。categories を渡すと、その大項目の工具すべてに割り当てる。
router.post('/create', authenticate, requireAdmin, async (req, res) => {
    const name = (req.body.name ?? '').trim();
    const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
    if (!name) return res.status(400).send('点検項目の名前を入力してください。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[{ next }]] = await conn.query(
            'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM inspection_items'
        );
        const [result] = await conn.query('INSERT INTO inspection_items (name, sort_order) VALUES (?, ?)', [
            name,
            next,
        ]);
        if (categories.length > 0) {
            await conn.query(
                `INSERT IGNORE INTO tool_inspection_items (tool_id, item_id)
                 SELECT id, ? FROM tools WHERE category IN (?)`,
                [result.insertId, categories]
            );
        }
        await conn.commit();
        res.status(201).json({ id: result.insertId });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('同じ名前の点検項目が既にあります。');
        console.error(err);
        res.status(500).send('点検項目の追加に失敗しました。');
    } finally {
        conn.release();
    }
});

// 名前・並び順の変更
router.post('/update', authenticate, requireAdmin, async (req, res) => {
    const { id, sortOrder } = req.body;
    const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
    if (!id) return res.status(400).send('IDは必須です。');
    if (name === '') return res.status(400).send('点検項目の名前を入力してください。');

    const sets = [];
    const params = [];
    if (name !== undefined) {
        sets.push('name = ?');
        params.push(name);
    }
    if (Number.isInteger(sortOrder)) {
        sets.push('sort_order = ?');
        params.push(sortOrder);
    }
    if (sets.length === 0) return res.status(400).send('更新する項目がありません。');

    try {
        const [result] = await db.query(`UPDATE inspection_items SET ${sets.join(', ')} WHERE id = ?`, [
            ...params,
            id,
        ]);
        if (result.affectedRows === 0) return res.status(404).send('点検項目が見つかりません。');
        res.json({ id });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('同じ名前の点検項目が既にあります。');
        console.error(err);
        res.status(500).send('点検項目の更新に失敗しました。');
    }
});

// 並び順の入れ替え（ids の順に並べ直す）
router.post('/reorder', authenticate, requireAdmin, async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).send('並び順を指定してください。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        for (const [i, id] of ids.entries()) {
            await conn.query('UPDATE inspection_items SET sort_order = ? WHERE id = ?', [i + 1, id]);
        }
        await conn.commit();
        res.json({ ids });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('並び替えに失敗しました。');
    } finally {
        conn.release();
    }
});

// 削除（工具への割り当ても消える。過去の点検記録は項目名を写して持っているので残る）
router.post('/delete', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');
    try {
        const [result] = await db.query('DELETE FROM inspection_items WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).send('点検項目が見つかりません。');
        res.json({ id });
    } catch (err) {
        console.error(err);
        res.status(500).send('点検項目の削除に失敗しました。');
    }
});

module.exports = router;
