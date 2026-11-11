const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const db = require('../db/pool').promise;
const { authenticate, requireAdmin } = require('../middleware/auth');
const { toToolResponse, toIsoDate, toRangeLabel } = require('../utils/format');
const { matchesKeyword } = require('../utils/search');
const { nowJst, toFullDateTime, PERIODS } = require('../utils/time');
const { withToolChangeLog } = require('../utils/changeLog');
const { isAdmin } = require('../utils/roles');

// 工具写真のアップロード先（router.js で /images として静的配信）。
// 既存 API に組み込むと cwd が変わるので __dirname 基準にする。
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../images')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
});
// 配信したときにブラウザがスクリプトとして実行しうる形式（SVG・HTML など）は受け付けない
const IMAGE_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
};
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!IMAGE_TYPES[ext] || IMAGE_TYPES[ext] !== file.mimetype) {
            const err = new Error('画像は JPEG・PNG・WebP・GIF のいずれかにしてください。');
            err.status = 400;
            return cb(err);
        }
        cb(null, true);
    },
});

const STATES = ['good', 'bad'];
const DEFECT_RANKS = ['minor', 'repair', 'replace', 'waiting'];

// 貸出中の情報を付けて工具を取得する共通 SELECT
const TOOL_SELECT = `
    SELECT t.*,
           r.id         AS rental_id,
           r.status     AS rental_status,
           r.start_date, r.start_period, r.end_date, r.end_period,
           r.taken_at, r.taken_by,
           e.id         AS user_id,
           e.name       AS user_name,
           e.team       AS user_team,
           tb.name      AS taken_by_name
      FROM tools t
      LEFT JOIN rentals r   ON r.tool_id = t.id AND r.status = 'renting'
      LEFT JOIN employees e ON e.id = r.employee_id
      LEFT JOIN employees tb ON tb.id = r.taken_by
`;

// 予約一覧（工具ごと、開始の早い順）
const fetchReservations = async (toolId) => {
    const [rows] = await db.query(
        `SELECT r.*, e.name AS user_name
           FROM rentals r
           JOIN employees e ON e.id = r.employee_id
          WHERE r.status = 'reserved' ${toolId ? 'AND r.tool_id = ?' : ''}
          ORDER BY r.start_date, r.start_period, r.id`,
        toolId ? [toolId] : []
    );
    return rows.map((r) => ({
        rentalId: r.id,
        toolId: r.tool_id,
        userId: r.employee_id,
        user: r.user_name,
        start: toIsoDate(r.start_date),
        startPeriod: r.start_period,
        end: toIsoDate(r.end_date),
        endPeriod: r.end_period,
        label: toRangeLabel(r),
    }));
};

// 工具一覧（工具リスト画面 / 借りる画面の検索）
// ?keyword= で名前・ID・使用者・持ち出し場所・大項目を絞り込む（全角/半角は区別しない）
// ?category= で大項目を絞り込む
// 無効化した工具は出さない。管理者が ?includeInactive=1 を付けたときだけ含める。
router.get('/get', authenticate, async (req, res) => {
    const includeInactive = isAdmin(req.user) && req.query.includeInactive === '1';
    try {
        const [rows] = await db.query(
            `${TOOL_SELECT} ${includeInactive ? '' : 'WHERE t.active = 1'} ORDER BY t.active DESC, t.id`
        );
        const reservations = await fetchReservations();

        let tools = rows.map((row) => {
            const own = reservations.filter((r) => r.toolId === row.id);
            return { ...toToolResponse(row), reservations: own };
        });

        const keyword = (req.query.keyword ?? '').trim();
        if (keyword) {
            tools = tools.filter((t) => matchesKeyword(keyword, [t.name, t.id, t.user, t.place, t.category]));
        }
        const category = (req.query.category ?? '').trim();
        if (category) tools = tools.filter((t) => t.category === category);

        res.json(tools);
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 工具詳細（QR読み取り / 詳細モーダル）。
// 使用履歴・予約・点検項目・点検記録・更新履歴もまとめて返す。
router.get('/get/:id', authenticate, async (req, res) => {
    const toolId = req.params.id;
    try {
        const [rows] = await db.query(`${TOOL_SELECT} WHERE t.id = ?`, [toolId]);
        if (rows.length === 0) return res.status(404).send('該当する工具がありません。');

        const [history] = await db.query(
            `SELECT r.*, e.name AS user_name, tb.name AS taken_by_name, rb.name AS returned_by_name
               FROM rentals r
               JOIN employees e       ON e.id = r.employee_id
               LEFT JOIN employees tb ON tb.id = r.taken_by
               LEFT JOIN employees rb ON rb.id = r.returned_by
              WHERE r.tool_id = ? AND r.status IN ('renting', 'returned')
              ORDER BY COALESCE(r.taken_at, r.start_date) DESC, r.id DESC
              LIMIT 50`,
            [toolId]
        );

        const [items] = await db.query(
            `SELECT i.id, i.name FROM tool_inspection_items ti
               JOIN inspection_items i ON i.id = ti.item_id
              WHERE ti.tool_id = ?
              ORDER BY i.sort_order, i.id`,
            [toolId]
        );

        const [inspections] = await db.query(
            `SELECT n.*, e.name AS employee_name
               FROM inspections n
               LEFT JOIN employees e ON e.id = n.employee_id
              WHERE n.tool_id = ?
              ORDER BY n.inspected_at DESC, n.id DESC
              LIMIT 20`,
            [toolId]
        );
        const [results] = inspections.length
            ? await db.query(
                  'SELECT * FROM inspection_results WHERE inspection_id IN (?) ORDER BY id',
                  [inspections.map((n) => n.id)]
              )
            : [[]];

        const [logs] = await db.query(
            `SELECT l.*, e.name AS employee_name
               FROM tool_change_logs l
               LEFT JOIN employees e ON e.id = l.employee_id
              WHERE l.tool_id = ?
              ORDER BY l.changed_at DESC, l.id DESC
              LIMIT 50`,
            [toolId]
        );

        res.json({
            ...toToolResponse(rows[0]),
            reservations: await fetchReservations(toolId),
            // 使用履歴（持ち出し・返却は時刻まで）
            history: history.map((h) => ({
                rentalId: h.id,
                start: toIsoDate(h.start_date),
                end: toIsoDate(h.end_date),
                endPeriod: h.end_period,
                endLabel: `${toIsoDate(h.end_date).replace(/-/g, '/')} ${PERIODS[h.end_period] ?? ''}`.trim(),
                takenAt: toFullDateTime(h.taken_at) || toIsoDate(h.start_date).replace(/-/g, '/'),
                returnedAt: toFullDateTime(h.returned_at),
                user: h.user_name,
                // 代理で操作した人（本人が操作したときは null）
                takenBy: h.taken_by && h.taken_by !== h.employee_id ? h.taken_by_name : null,
                returnedBy: h.returned_by && h.returned_by !== h.employee_id ? h.returned_by_name : null,
                status: h.status,
            })),
            inspectionItems: items,
            inspections: inspections.map((n) => ({
                id: n.id,
                inspectedAt: toFullDateTime(n.inspected_at),
                employee: n.employee_name ?? '',
                result: n.result,
                note: n.note ?? '',
                results: results
                    .filter((r) => r.inspection_id === n.id)
                    .map((r) => ({ name: r.item_name, ok: Boolean(r.ok) })),
            })),
            changeLogs: logs.map((l) => ({
                id: l.id,
                changedAt: toFullDateTime(l.changed_at),
                employee: l.employee_name ?? '',
                source: l.source,
                changes: JSON.parse(l.changes),
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

// 状態・不良ランクの値を確かめる。良好なら不良ランク・不良内容は空にする。
const validateDefect = ({ state, defectRank }) => {
    if (state !== undefined && !STATES.includes(state)) return '状態の値が正しくありません。';
    if (defectRank !== undefined && defectRank !== null && defectRank !== '' && !DEFECT_RANKS.includes(defectRank)) {
        return '不良ランクの値が正しくありません。';
    }
    return null;
};

// 点検の周期（月）。空・null は「期限なし」。1〜120 の整数のみ。
const parseInterval = (value) => {
    if (value === undefined || value === null || value === '') return { value: null };
    const months = Number(value);
    if (!Number.isInteger(months) || months < 1 || months > 120) {
        return { error: '点検の周期は 1〜120 か月の整数で入力してください。' };
    }
    return { value: months };
};

// QR コードと URL に入るので、記号や空白は使わせない
const ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

// 点検項目の割り当てを入れ替える
const setInspectionItems = async (conn, toolId, itemIds) => {
    await conn.query('DELETE FROM tool_inspection_items WHERE tool_id = ?', [toolId]);
    const ids = [...new Set((itemIds ?? []).map(Number).filter(Number.isInteger))];
    if (ids.length === 0) return;
    await conn.query('INSERT INTO tool_inspection_items (tool_id, item_id) VALUES ?', [
        ids.map((id) => [toolId, id]),
    ]);
};

// 工具追加（管理者のみ）
router.post('/create', authenticate, requireAdmin, async (req, res) => {
    const {
        id,
        name,
        category,
        photoUrl,
        state = 'good',
        defectRank,
        defectNote,
        pin,
        purchaseDate,
        lastInspectionDate,
        inspectionIntervalMonths,
        inspectionItemIds,
    } = req.body;
    if (!id || !name) return res.status(400).send('IDと名前は必須です。');
    if (!ID_PATTERN.test(String(id))) {
        return res.status(400).send('工具IDは半角の英数字・ハイフン・アンダーバー（32文字まで）で入力してください。');
    }
    const invalid = validateDefect({ state, defectRank });
    if (invalid) return res.status(400).send(invalid);
    const interval = parseInterval(inspectionIntervalMonths);
    if (interval.error) return res.status(400).send(interval.error);
    const isGood = state === 'good';

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            `INSERT INTO tools
               (id, name, category, photo_url, state, defect_rank, defect_note,
                pin_x, pin_y, purchase_date, last_inspection_date, inspection_interval_months)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                name,
                category || null,
                photoUrl || null,
                state,
                isGood ? null : defectRank || null,
                isGood ? null : defectNote || null,
                pin?.x ?? null,
                pin?.y ?? null,
                purchaseDate || null,
                lastInspectionDate || null,
                interval.value,
            ]
        );
        await setInspectionItems(conn, id, inspectionItemIds);
        await conn.commit();
        res.status(201).json({ id });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_DUP_ENTRY') {
            return res
                .status(409)
                .send('そのIDの工具は既に登録されています（無効化した工具の場合は「元に戻す」を使ってください）。');
        }
        console.error(err);
        res.status(500).send('工具の追加に失敗しました。');
    } finally {
        conn.release();
    }
});

// 本体に渡された項目だけを更新する（項目を省くと現在値のまま、null や '' を渡すと空にする）。
// 名前・大項目・写真・購入日・点検の周期・点検項目の変更は管理者のみ。
const ADMIN_FIELDS = ['name', 'category', 'photoUrl', 'purchaseDate', 'inspectionIntervalMonths', 'inspectionItemIds'];

router.post('/update', authenticate, async (req, res) => {
    const body = req.body;
    const { id } = body;
    if (!id) return res.status(400).send('IDは必須です。');
    if (!isAdmin(req.user) && ADMIN_FIELDS.some((f) => f in body)) {
        return res.status(403).send('名前・大項目・写真・購入日・点検の周期・点検項目の変更は管理者のみ可能です。');
    }
    const interval = parseInterval(body.inspectionIntervalMonths);
    if (interval.error) return res.status(400).send(interval.error);
    const invalid = validateDefect(body);
    if (invalid) return res.status(400).send(invalid);
    if ('name' in body && !body.name) return res.status(400).send('名前は空にできません。');

    const sets = [];
    const params = [];
    const set = (key, column, value = body[key]) => {
        if (!(key in body)) return;
        sets.push(`${column} = ?`);
        params.push(value === '' ? null : value ?? null);
    };
    set('name', 'name');
    set('category', 'category');
    set('photoUrl', 'photo_url');
    set('state', 'state');
    set('defectRank', 'defect_rank');
    set('defectNote', 'defect_note');
    set('purchaseDate', 'purchase_date');
    set('lastInspectionDate', 'last_inspection_date');
    set('inspectionIntervalMonths', 'inspection_interval_months', interval.value);
    if ('pin' in body) {
        sets.push('pin_x = ?', 'pin_y = ?');
        params.push(body.pin?.x ?? null, body.pin?.y ?? null);
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [exists] = await conn.query('SELECT id FROM tools WHERE id = ? AND active = 1 FOR UPDATE', [id]);
        if (exists.length === 0) {
            await conn.rollback();
            return res.status(404).send('該当する工具がありません。');
        }

        await withToolChangeLog(
            conn,
            { toolId: id, employeeId: req.user.id, source: 'edit', items: 'inspectionItemIds' in body },
            async () => {
                if (sets.length > 0) {
                    await conn.query(`UPDATE tools SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
                }
                // 良好に戻したら不良ランク・不良内容は消す（変更前の内容は更新履歴に残る）
                await conn.query(
                    `UPDATE tools SET defect_rank = NULL, defect_note = NULL WHERE id = ? AND state = 'good'`,
                    [id]
                );
                if ('inspectionItemIds' in body) await setInspectionItems(conn, id, body.inspectionItemIds);
            }
        );

        await conn.commit();
        res.json({ id });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('工具の更新に失敗しました。');
    } finally {
        conn.release();
    }
});

// 点検の記録。
// results: [{ itemId, ok }]。最終点検日を今日にし、NG があれば状態・不良内容も一緒に更新できる。
router.post('/inspect', authenticate, async (req, res) => {
    const { toolId, results = [], note, state, defectRank, defectNote } = req.body;
    if (!toolId) return res.status(400).send('工具IDは必須です。');
    if (!Array.isArray(results) || results.length === 0) {
        return res.status(400).send('点検項目の結果を入力してください。');
    }
    const invalid = validateDefect({ state, defectRank });
    if (invalid) return res.status(400).send(invalid);

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [tools] = await conn.query('SELECT id FROM tools WHERE id = ? AND active = 1 FOR UPDATE', [toolId]);
        if (tools.length === 0) {
            await conn.rollback();
            return res.status(404).send('該当する工具がありません。');
        }

        // 項目名は記録時点のものを写して残す
        const [items] = await conn.query('SELECT id, name FROM inspection_items WHERE id IN (?)', [
            results.map((r) => Number(r.itemId)),
        ]);
        const names = new Map(items.map((i) => [i.id, i.name]));
        const rows = results
            .filter((r) => names.has(Number(r.itemId)))
            .map((r) => ({ name: names.get(Number(r.itemId)), ok: Boolean(r.ok) }));
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(400).send('点検項目が見つかりません。');
        }

        const now = nowJst();
        const ng = rows.some((r) => !r.ok);
        const [result] = await conn.query(
            `INSERT INTO inspections (tool_id, employee_id, inspected_at, result, note)
             VALUES (?, ?, ?, ?, ?)`,
            [toolId, req.user.id, now, ng ? 'ng' : 'ok', note || null]
        );
        await conn.query('INSERT INTO inspection_results (inspection_id, item_name, ok) VALUES ?', [
            rows.map((r) => [result.insertId, r.name, r.ok ? 1 : 0]),
        ]);

        await withToolChangeLog(conn, { toolId, employeeId: req.user.id, source: 'inspect' }, async () => {
            const sets = ['last_inspection_date = ?'];
            const params = [now.slice(0, 10)];
            if (state) {
                sets.push('state = ?', 'defect_rank = ?', 'defect_note = ?');
                params.push(
                    state,
                    state === 'good' ? null : defectRank || null,
                    state === 'good' ? null : defectNote || null
                );
            }
            await conn.query(`UPDATE tools SET ${sets.join(', ')} WHERE id = ?`, [...params, toolId]);
        });

        await conn.commit();
        res.status(201).json({ inspectionId: result.insertId, result: ng ? 'ng' : 'ok' });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('点検の記録に失敗しました。');
    } finally {
        conn.release();
    }
});

// 工具の無効化（管理者のみ）。廃棄などで使わなくなった工具を一覧から外す。
// 行は消さないので、貸出・点検・更新の履歴は残る。予約は取り消す。
// 貸出中の工具は無効化できない（先に返却する）。
router.post('/delete', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT id FROM tools WHERE id = ? AND active = 1 FOR UPDATE', [id]);
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).send('該当する工具がありません。');
        }
        const [renting] = await conn.query(
            `SELECT COUNT(*) AS c FROM rentals WHERE tool_id = ? AND status = 'renting'`,
            [id]
        );
        if (Number(renting[0].c) > 0) {
            await conn.rollback();
            return res.status(409).send('貸出中のため無効化できません。返却してから無効化してください。');
        }

        await conn.query(
            `UPDATE rentals SET status = 'cancelled', returned_by = ? WHERE tool_id = ? AND status = 'reserved'`,
            [req.user.id, id]
        );
        await withToolChangeLog(conn, { toolId: id, employeeId: req.user.id, source: 'edit' }, () =>
            conn.query('UPDATE tools SET active = 0, deactivated_at = ? WHERE id = ?', [nowJst(), id])
        );
        await conn.commit();
        res.json({ id });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('工具の無効化に失敗しました。');
    } finally {
        conn.release();
    }
});

// 無効化した工具を元に戻す（管理者のみ）
router.post('/restore', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send('IDは必須です。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query('SELECT id FROM tools WHERE id = ? AND active = 0 FOR UPDATE', [id]);
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).send('無効化された工具が見つかりません。');
        }
        await withToolChangeLog(conn, { toolId: id, employeeId: req.user.id, source: 'edit' }, () =>
            conn.query('UPDATE tools SET active = 1, deactivated_at = NULL WHERE id = ?', [id])
        );
        await conn.commit();
        res.json({ id });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('工具を元に戻せませんでした。');
    } finally {
        conn.release();
    }
});

module.exports = router;
