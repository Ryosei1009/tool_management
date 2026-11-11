const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/pool').promise;
const { authenticate, requireAdmin, signToken } = require('../middleware/auth');
const { getMapName } = require('../utils/map');
const { toEmployeeResponse } = require('../utils/format');
const { toFullDateTime, nowJst } = require('../utils/time');
const { validatePassword } = require('../utils/password');
const { ROLES, MEMBER, isAdmin, canManageAccount } = require('../utils/roles');

// 社員一覧（「渡す」のユーザー選択・社員一覧画面）
// 社員一覧画面で使うので、貸出中の件数も一緒に返す。
// 無効化した社員は出さない。管理者が ?includeInactive=1 を付けたときだけ含める。
// ロック中かどうか（locked）は、解除できる人（管理者・同じ班の班長）にだけ返す。
router.get('/get', authenticate, async (req, res) => {
    const includeInactive = isAdmin(req.user) && req.query.includeInactive === '1';
    try {
        const [rows] = await db.query(
            `SELECT e.*, COUNT(r.id) AS renting_count
               FROM employees e
               LEFT JOIN rentals r ON r.employee_id = e.id AND r.status = 'renting'
              ${includeInactive ? '' : 'WHERE e.active = 1'}
              GROUP BY e.id
              ORDER BY e.active DESC, e.id`
        );
        const now = nowJst();
        res.json(
            rows.map((e) => ({
                ...toEmployeeResponse(e),
                rentingCount: Number(e.renting_count),
                ...(canManageAccount(req.user, e) && {
                    locked: Boolean(e.locked_until) && String(e.locked_until) > now,
                    canManage: true,
                }),
            }))
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
            `SELECT r.start_date, r.taken_at, r.returned_at, r.status, r.taken_by, r.employee_id,
                    t.name AS tool_name, t.pin_x, t.pin_y, tb.name AS taken_by_name
               FROM rentals r
               JOIN tools t ON t.id = r.tool_id
               LEFT JOIN employees tb ON tb.id = r.taken_by
              WHERE r.employee_id = ? AND r.status IN ('renting', 'returned')
              ORDER BY COALESCE(r.taken_at, r.start_date) DESC, r.id DESC
              LIMIT 50`,
            [req.user.id]
        );

        res.json({
            ...toEmployeeResponse(employee),
            // 「2026/06/30 9:05　プラスドライバー（A4）　〜 2026/07/01 16:30 返却」の形式で返す
            histories: histories.map((h) => {
                const taken = toFullDateTime(h.taken_at) || String(h.start_date).slice(0, 10).replace(/-/g, '/');
                const place = getMapName(h.pin_x, h.pin_y);
                const returned = h.status === 'returned' ? toFullDateTime(h.returned_at) : '';
                const proxy = h.taken_by && h.taken_by !== h.employee_id ? `（代理：${h.taken_by_name}）` : '';
                return `${taken}　${h.tool_name}${place ? `（${place}）` : ''}${proxy}${
                    h.status === 'renting' ? '　貸出中' : returned ? `　〜 ${returned} 返却` : ''
                }`;
            }),
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 社員追加（管理者のみ）。初期パスワードは、本人が初回ログインで変更する。
router.post('/create', authenticate, requireAdmin, async (req, res) => {
    const { id, name, team, bloodType, permission, photoUrl, password, defaultPin } = req.body;
    if (!id || !name || !password) return res.status(400).send('ID・名前・パスワードは必須です。');
    if (permission && !ROLES.includes(permission)) return res.status(400).send('権限の値が正しくありません。');
    const invalid = validatePassword(password, id);
    if (invalid) return res.status(400).send(invalid);

    try {
        const hash = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO employees
               (id, name, team, blood_type, permission, photo_url, password_hash, must_change_password,
                default_pin_x, default_pin_y)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
                id,
                name,
                team || null,
                bloodType || null,
                permission ?? MEMBER,
                photoUrl ?? null,
                hash,
                defaultPin?.x ?? null,
                defaultPin?.y ?? null,
            ]
        );
        res.status(201).json({ id });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res
                .status(409)
                .send('その社員IDは既に登録されています（無効化した社員の場合は「元に戻す」を使ってください）。');
        }
        console.error(err);
        res.status(500).send('社員の追加に失敗しました。');
    }
});

// 社員情報の更新。
// 本人が変えられるのは既定の持ち出し場所と写真だけ。名前・班・権限・血液型は管理者のみ
// （班を自分で変えられると、他の班のメンバーの代理操作ができてしまうため）。
const ADMIN_FIELDS = ['name', 'team', 'bloodType', 'permission'];

router.post('/update', authenticate, async (req, res) => {
    const { id, name, team, bloodType, permission, photoUrl, defaultPin } = req.body;
    const targetId = id ?? req.user.id;
    const admin = isAdmin(req.user);

    if (targetId !== req.user.id && !admin) return res.status(403).send('権限がありません');
    if (!admin && ADMIN_FIELDS.some((f) => req.body[f] !== undefined && req.body[f] !== null)) {
        return res.status(403).send('名前・所属班・権限・血液型の変更は管理者のみ可能です。');
    }
    if (permission && !ROLES.includes(permission)) return res.status(400).send('権限の値が正しくありません。');
    if (permission && targetId === req.user.id && permission !== req.user.permission) {
        return res.status(400).send('自分自身の権限は変更できません。');
    }
    if (name !== undefined && name !== null && !String(name).trim()) {
        return res.status(400).send('名前は空にできません。');
    }

    // 指定された項目だけ更新する
    const sets = [];
    const params = [];
    const setIfGiven = (column, value) => {
        if (value === undefined || value === null) return;
        sets.push(`${column} = ?`);
        params.push(value === '' ? null : value);
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

// 社員の無効化（管理者のみ）。行は消さないので、過去の貸出履歴に名前が残る。
// 無効化した社員はログインできず、一覧にも出ない。予約は取り消す。
// 貸出中の工具がある社員は無効化できない（先に返却か引き渡しをする）。
router.post('/delete', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');
    if (id === req.user.id) return res.status(400).send('自分自身は無効化できません。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT id FROM employees WHERE id = ? AND active = 1 FOR UPDATE', [id]);
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).send('社員が見つかりません。');
        }
        const [renting] = await conn.query(
            `SELECT COUNT(*) AS c FROM rentals WHERE employee_id = ? AND status = 'renting'`,
            [id]
        );
        if (Number(renting[0].c) > 0) {
            await conn.rollback();
            return res.status(409).send('貸出中の工具があるため無効化できません。');
        }

        await conn.query(
            `UPDATE rentals SET status = 'cancelled', returned_by = ? WHERE employee_id = ? AND status = 'reserved'`,
            [req.user.id, id]
        );
        // token_version を進めて、発行済みのトークンも使えなくする
        await conn.query(
            `UPDATE employees
                SET active = 0, deactivated_at = ?, token_version = token_version + 1,
                    failed_logins = 0, locked_until = NULL
              WHERE id = ?`,
            [nowJst(), id]
        );
        await conn.commit();
        res.json({ id });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('社員の無効化に失敗しました。');
    } finally {
        conn.release();
    }
});

// 無効化した社員を元に戻す（管理者のみ）
router.post('/restore', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');
    try {
        const [result] = await db.query(
            'UPDATE employees SET active = 1, deactivated_at = NULL WHERE id = ? AND active = 0',
            [id]
        );
        if (result.affectedRows === 0) return res.status(404).send('無効化された社員が見つかりません。');
        res.json({ id });
    } catch (err) {
        console.error(err);
        res.status(500).send('社員を元に戻せませんでした。');
    }
});

// パスワード変更。
// ・本人 … 現在のパスワードの確認が必要。変更後も使い続けられるよう新しいトークンを返す
// ・管理者、同じ班の班長 … 他の社員のパスワードを初期化する。本人は次のログインで変更する
// どちらも token_version を進めるので、それまでに発行したトークンは無効になる。
router.post('/password', authenticate, async (req, res) => {
    const { id, password, currentPassword } = req.body;
    const targetId = id ?? req.user.id;
    const isSelf = targetId === req.user.id;

    try {
        const [rows] = await db.query('SELECT * FROM employees WHERE id = ? AND active = 1', [targetId]);
        const target = rows[0];
        if (!target) return res.status(404).send('社員が見つかりません。');

        if (isSelf) {
            if (!currentPassword) return res.status(400).send('現在のパスワードを入力してください。');
            const ok = await bcrypt.compare(String(currentPassword), target.password_hash);
            if (!ok) return res.status(400).send('現在のパスワードが違います。');
            if (password === currentPassword) {
                return res.status(400).send('現在と同じパスワードは使えません。');
            }
        } else if (!canManageAccount(req.user, target)) {
            return res.status(403).send('権限がありません');
        }

        const invalid = validatePassword(password, targetId);
        if (invalid) return res.status(400).send(invalid);

        const hash = await bcrypt.hash(password, 10);
        await db.query(
            `UPDATE employees
                SET password_hash = ?, must_change_password = ?, token_version = token_version + 1,
                    failed_logins = 0, locked_until = NULL
              WHERE id = ?`,
            [hash, isSelf ? 0 : 1, targetId]
        );

        res.json({
            id: targetId,
            ...(isSelf && { token: signToken({ id: targetId, token_version: target.token_version + 1 }) }),
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('パスワードの変更に失敗しました。');
    }
});

// ログインのロックを解除する（管理者、同じ班の班長）
router.post('/unlock', authenticate, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');
    try {
        const [rows] = await db.query('SELECT * FROM employees WHERE id = ? AND active = 1', [id]);
        const target = rows[0];
        if (!target) return res.status(404).send('社員が見つかりません。');
        if (!canManageAccount(req.user, target)) return res.status(403).send('権限がありません');

        await db.query('UPDATE employees SET failed_logins = 0, locked_until = NULL WHERE id = ?', [id]);
        res.json({ id });
    } catch (err) {
        console.error(err);
        res.status(500).send('ロックの解除に失敗しました。');
    }
});

module.exports = router;
