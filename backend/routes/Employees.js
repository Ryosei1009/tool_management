const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/pool').promise;
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getMapName } = require('../utils/map');
const { toEmployeeResponse } = require('../utils/format');

// 社員一覧（「渡す」のユーザー選択・社員一覧画面）
// 社員一覧画面で使うので、貸出中の件数も一緒に返す。
router.get('/get', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, COUNT(r.id) AS renting_count
               FROM employees e
               LEFT JOIN rentals r ON r.employee_id = e.id AND r.status = 'renting'
              GROUP BY e.id
              ORDER BY e.id`
        );
        res.json(
            rows.map((e) => ({ ...toEmployeeResponse(e), rentingCount: Number(e.renting_count) }))
        );
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// マイページ（ログイン中の社員の情報 + 過去の使用履歴）
router.get('/me', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM employees WHERE id = ?', [req.user.id]);
        const employee = rows[0];
        if (!employee) return res.status(404).send('社員が見つかりません。');

        const [histories] = await db.query(
            `SELECT r.start_date, t.name AS tool_name, t.pin_x, t.pin_y
               FROM rentals r
               JOIN tools t ON t.id = r.tool_id
              WHERE r.employee_id = ?
              ORDER BY r.start_date DESC, r.id DESC
              LIMIT 50`,
            [req.user.id]
        );

        res.json({
            ...toEmployeeResponse(employee),
            // 「2026/06/30　プラスドライバー（A4）」の形式で返す
            histories: histories.map((h) => {
                const date = String(h.start_date).slice(0, 10).replace(/-/g, '/');
                const place = getMapName(Number(h.pin_x), Number(h.pin_y));
                return `${date}　${h.tool_name}${place ? `（${place}）` : ''}`;
            }),
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 社員追加（管理者のみ）
router.post('/create', authenticate, requireAdmin, async (req, res) => {
    const { id, name, team, bloodType, permission, photoUrl, password, defaultPin } = req.body;
    if (!id || !name || !password) return res.status(400).send('ID・名前・パスワードは必須です。');

    try {
        const hash = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO employees
               (id, name, team, blood_type, permission, photo_url, password_hash, default_pin_x, default_pin_y)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                name,
                team ?? null,
                bloodType ?? null,
                permission ?? '一般',
                photoUrl ?? null,
                hash,
                defaultPin?.x ?? null,
                defaultPin?.y ?? null,
            ]
        );
        res.status(201).json({ id });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('その社員IDは既に登録されています。');
        console.error(err);
        res.status(500).send('社員の追加に失敗しました。');
    }
});

// 社員情報の更新。権限の変更は管理者のみ、本人は自分の情報のみ更新できる。
router.post('/update', authenticate, async (req, res) => {
    const { id, name, team, bloodType, permission, photoUrl, defaultPin } = req.body;
    const targetId = id ?? req.user.id;
    const isAdmin = req.user.permission === '管理者';

    if (targetId !== req.user.id && !isAdmin) return res.status(403).send('権限がありません');
    if (permission && !isAdmin) return res.status(403).send('権限の変更は管理者のみ可能です。');

    // 指定された項目だけ更新する
    const sets = [];
    const params = [];
    const setIfGiven = (column, value) => {
        if (value === undefined || value === null) return;
        sets.push(`${column} = ?`);
        params.push(value);
    };
    setIfGiven('name', name);
    setIfGiven('team', team);
    setIfGiven('blood_type', bloodType);
    setIfGiven('permission', permission);
    setIfGiven('photo_url', photoUrl);

    // defaultPin は null を明示的に渡すと解除、未指定なら現状維持
    if (defaultPin === null) {
        sets.push('default_pin_x = NULL', 'default_pin_y = NULL');
    } else if (defaultPin) {
        sets.push('default_pin_x = ?', 'default_pin_y = ?');
        params.push(defaultPin.x, defaultPin.y);
    }

    if (sets.length === 0) return res.status(400).send('更新する項目がありません。');
    params.push(targetId);

    try {
        const [result] = await db.query(
            `UPDATE employees SET ${sets.join(', ')} WHERE id = ?`,
            params
        );
        if (result.affectedRows === 0) return res.status(404).send('社員が見つかりません。');
        res.json({ id: targetId });
    } catch (err) {
        console.error(err);
        res.status(500).send('社員情報の更新に失敗しました。');
    }
});

// 社員削除（管理者のみ）。貸出中の工具がある社員は削除できない。
router.post('/delete', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');
    if (id === req.user.id) return res.status(400).send('自分自身は削除できません。');

    try {
        const [renting] = await db.query(
            `SELECT COUNT(*) AS c FROM rentals WHERE employee_id = ? AND status = 'renting'`,
            [id]
        );
        if (Number(renting[0].c) > 0) {
            return res.status(409).send('貸出中の工具があるため削除できません。');
        }

        const [result] = await db.query('DELETE FROM employees WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).send('社員が見つかりません。');
        res.json({ id });
    } catch (err) {
        console.error(err);
        res.status(500).send('社員の削除に失敗しました。');
    }
});

// パスワード変更（本人、または管理者）
router.post('/password', authenticate, async (req, res) => {
    const { id, password } = req.body;
    const targetId = id ?? req.user.id;
    if (!password) return res.status(400).send('パスワードは必須です。');
    if (targetId !== req.user.id && req.user.permission !== '管理者') {
        return res.status(403).send('権限がありません');
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.query('UPDATE employees SET password_hash = ? WHERE id = ?', [
            hash,
            targetId,
        ]);
        if (result.affectedRows === 0) return res.status(404).send('社員が見つかりません。');
        res.json({ id: targetId });
    } catch (err) {
        console.error(err);
        res.status(500).send('パスワードの変更に失敗しました。');
    }
});

module.exports = router;
