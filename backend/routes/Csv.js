const express = require('express');
const router = express.Router();
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('../db/pool').promise;
const { authenticate, requireAdmin } = require('../middleware/auth');
const { toCsv, parseTable, toIsoDateCell } = require('../utils/csv');
const { toToolResponse, toIsoDate } = require('../utils/format');
const { STATE_LABELS, DEFECT_RANK_LABELS, withToolChangeLog } = require('../utils/changeLog');
const { validatePassword } = require('../utils/password');
const { ROLES, MEMBER } = require('../utils/roles');
const { PERIODS, todayJst } = require('../utils/time');

// CSV の入出力（すべて管理者のみ）。
//   出力 … 工具台帳 / 貸出履歴 / 点検履歴 / 社員一覧（取り込み用のひな形を兼ねる）
//   取込 … 工具の一括登録・更新 / 社員の一括登録・更新
// 取り込みは ?dryRun=1 で内容とエラー行だけを確かめられる。1行でもエラーがあれば何も登録しない。

router.use(authenticate, requireAdmin);

const MAX_ROWS = 2000;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const sendCsv = (res, filename, headers, rows) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(toCsv(headers, rows));
};

const stamp = () => todayJst().replace(/-/g, '');

// 表示名 → DB の値
const invert = (labels) => Object.fromEntries(Object.entries(labels).map(([k, v]) => [v, k]));
const STATE_VALUES = invert(STATE_LABELS);
const DEFECT_RANK_VALUES = { ...invert(DEFECT_RANK_LABELS), 軽微: 'minor' };

/* ---------------- 工具台帳の出力 ---------------- */

const TOOL_HEADERS = [
    '工具ID',
    '名前',
    '大項目',
    '購入日',
    '状態',
    '不良ランク',
    '不良内容',
    '最終点検日',
    '点検の周期（月）',
    // ここから下は出力のみ（取り込みでは読まない）
    '次回点検日',
    '持ち出し場所',
    '貸出状況',
    '使用者',
    '返却予定',
    '利用',
];

router.get('/tools/export', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT t.*, r.id AS rental_id, r.status AS rental_status,
                    r.start_date, r.start_period, r.end_date, r.end_period, r.taken_at, r.taken_by,
                    e.id AS user_id, e.name AS user_name, e.team AS user_team
               FROM tools t
               LEFT JOIN rentals r   ON r.tool_id = t.id AND r.status = 'renting'
               LEFT JOIN employees e ON e.id = r.employee_id
              ORDER BY t.active DESC, t.id`
        );
        const body = rows.map(toToolResponse).map((t) => [
            t.id,
            t.name,
            t.category ?? '',
            t.purchaseDate,
            STATE_LABELS[t.state] ?? t.state,
            DEFECT_RANK_LABELS[t.defectRank] ?? '',
            t.defectNote,
            t.lastInspectionDate,
            t.inspectionIntervalMonths ?? '',
            t.inspection.nextDate,
            t.place ?? '',
            t.isRented ? (t.isOverdue ? '貸出中（返却遅れ）' : '貸出中') : '貸出可能',
            t.user,
            t.isRented ? `${t.rentEnd} ${PERIODS[t.rentEndPeriod] ?? ''}`.trim() : '',
            t.active ? '利用中' : '無効化',
        ]);
        sendCsv(res, `tools_${stamp()}.csv`, TOOL_HEADERS, body);
    } catch (err) {
        console.error(err);
        res.status(500).send('工具台帳の出力に失敗しました。');
    }
});

/* ---------------- 貸出・点検履歴の出力 ---------------- */

// ?from=YYYY-MM-DD&to=YYYY-MM-DD（両方とも省略できる）
const parsePeriod = (query) => {
    const from = toIsoDateCell(query.from);
    const to = toIsoDateCell(query.to);
    if (from === null || to === null) return { error: '期間の日付が正しくありません。' };
    if (from && to && from > to) return { error: '期間の開始は終了より前にしてください。' };
    return { from, to };
};

const RENTAL_STATUS_LABELS = { reserved: '予約', renting: '貸出中', returned: '返却済み', cancelled: '予約取消' };

router.get('/rentals/export', async (req, res) => {
    const period = parsePeriod(req.query);
    if (period.error) return res.status(400).send(period.error);

    try {
        const where = [];
        const params = [];
        if (period.from) {
            where.push('r.start_date >= ?');
            params.push(period.from);
        }
        if (period.to) {
            where.push('r.start_date <= ?');
            params.push(period.to);
        }
        const [rows] = await db.query(
            `SELECT r.*, t.name AS tool_name, e.name AS user_name, e.team AS user_team,
                    tb.name AS taken_by_name, rb.name AS returned_by_name
               FROM rentals r
               JOIN tools t           ON t.id = r.tool_id
               JOIN employees e       ON e.id = r.employee_id
               LEFT JOIN employees tb ON tb.id = r.taken_by
               LEFT JOIN employees rb ON rb.id = r.returned_by
              ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
              ORDER BY r.start_date, r.start_period, r.id`,
            params
        );
        sendCsv(
            res,
            `rentals_${stamp()}.csv`,
            [
                '貸出ID',
                '工具ID',
                '工具名',
                '社員ID',
                '借りた人',
                '所属班',
                '状態',
                '開始日',
                '開始',
                '返却予定日',
                '返却予定',
                '持ち出し日時',
                '持ち出しの操作者',
                '返却日時',
                '返却の操作者',
            ],
            rows.map((r) => [
                r.id,
                r.tool_id,
                r.tool_name,
                r.employee_id,
                r.user_name,
                r.user_team ?? '',
                RENTAL_STATUS_LABELS[r.status] ?? r.status,
                toIsoDate(r.start_date),
                PERIODS[r.start_period] ?? '',
                toIsoDate(r.end_date),
                PERIODS[r.end_period] ?? '',
                r.taken_at ?? '',
                r.taken_by_name ?? '',
                r.returned_at ?? '',
                r.status === 'returned' ? (r.returned_by_name ?? '') : '',
            ])
        );
    } catch (err) {
        console.error(err);
        res.status(500).send('貸出履歴の出力に失敗しました。');
    }
});

router.get('/inspections/export', async (req, res) => {
    const period = parsePeriod(req.query);
    if (period.error) return res.status(400).send(period.error);

    try {
        const where = [];
        const params = [];
        if (period.from) {
            where.push('n.inspected_at >= ?');
            params.push(`${period.from} 00:00:00`);
        }
        if (period.to) {
            where.push('n.inspected_at <= ?');
            params.push(`${period.to} 23:59:59`);
        }
        const [rows] = await db.query(
            `SELECT n.*, t.name AS tool_name, e.name AS employee_name
               FROM inspections n
               JOIN tools t          ON t.id = n.tool_id
               LEFT JOIN employees e ON e.id = n.employee_id
              ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
              ORDER BY n.inspected_at, n.id`,
            params
        );
        const [results] = rows.length
            ? await db.query('SELECT * FROM inspection_results WHERE inspection_id IN (?) ORDER BY id', [
                  rows.map((n) => n.id),
              ])
            : [[]];

        sendCsv(
            res,
            `inspections_${stamp()}.csv`,
            ['点検ID', '点検日時', '工具ID', '工具名', '点検した人', '結果', 'NG の項目', '項目ごとの結果', 'メモ'],
            rows.map((n) => {
                const own = results.filter((r) => r.inspection_id === n.id);
                return [
                    n.id,
                    n.inspected_at,
                    n.tool_id,
                    n.tool_name,
                    n.employee_name ?? '',
                    n.result === 'ok' ? 'OK' : 'NG',
                    own
                        .filter((r) => !r.ok)
                        .map((r) => r.item_name)
                        .join('、'),
                    own.map((r) => `${r.item_name}:${r.ok ? 'OK' : 'NG'}`).join(' / '),
                    n.note ?? '',
                ];
            })
        );
    } catch (err) {
        console.error(err);
        res.status(500).send('点検履歴の出力に失敗しました。');
    }
});

/* ---------------- 社員一覧の出力（取り込み用のひな形を兼ねる） ---------------- */

const EMPLOYEE_HEADERS = ['社員ID', '社員名', '所属班', '権限', '血液型', '初期パスワード'];

router.get('/employees/export', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM employees WHERE active = 1 ORDER BY id');
        sendCsv(
            res,
            `employees_${stamp()}.csv`,
            EMPLOYEE_HEADERS,
            // パスワードは出力しない（列だけ用意する）
            rows.map((e) => [e.id, e.name, e.team ?? '', e.permission, e.blood_type ?? '', ''])
        );
    } catch (err) {
        console.error(err);
        res.status(500).send('社員一覧の出力に失敗しました。');
    }
});

/* ---------------- 取り込みの共通処理 ---------------- */

// ファイルを読み、必須の見出しがあるか確かめる。問題があれば { error }。
const readUpload = (req, required) => {
    if (!req.file) return { error: 'CSV ファイルを選んでください。' };
    const { headers, records } = parseTable(req.file.buffer);
    if (headers.length === 0) return { error: 'CSV の中身が空です。' };
    const missing = required.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
        return { error: `見出しが足りません：${missing.join('、')}（1行目に見出しを入れてください）` };
    }
    if (records.length === 0) return { error: '取り込む行がありません。' };
    if (records.length > MAX_ROWS) return { error: `一度に取り込めるのは ${MAX_ROWS} 行までです。` };
    return { headers, records };
};

// 取り込み結果の集計
const summarize = (rows) => ({
    total: rows.length,
    create: rows.filter((r) => r.action === 'create').length,
    update: rows.filter((r) => r.action === 'update').length,
    error: rows.filter((r) => r.action === 'error').length,
});

// multer のエラー（大きすぎるなど）を分かる文言で返す
const receive = (req, res, next) =>
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).send('ファイルが大きすぎます（2MB まで）。');
        res.status(400).send('ファイルを読み込めませんでした。');
    });

/* ---------------- 工具の一括登録・更新 ---------------- */

const TOOL_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

// 1行を確かめて、登録する値にする。messages が空でなければエラー。
// 見出しがある列だけを扱う（列ごと無ければ、更新のときは今の値のまま）。
const toToolRow = (record, headers, existing) => {
    const messages = [];
    const has = (h) => headers.includes(h);
    const id = record['工具ID'];
    const values = {};

    if (!id) messages.push('工具IDが空です。');
    else if (!TOOL_ID_PATTERN.test(id)) {
        messages.push('工具IDは半角の英数字・ハイフン・アンダーバー（32文字まで）にしてください。');
    }

    if (has('名前')) {
        if (!record['名前']) messages.push('名前が空です。');
        else if (record['名前'].length > 64) messages.push('名前は 64 文字までです。');
        else values.name = record['名前'];
    } else if (!existing) {
        messages.push('新しい工具には「名前」の列が必要です。');
    }

    if (has('大項目')) {
        if (record['大項目'].length > 32) messages.push('大項目は 32 文字までです。');
        else values.category = record['大項目'] || null;
    }

    for (const [header, key] of [
        ['購入日', 'purchase_date'],
        ['最終点検日', 'last_inspection_date'],
    ]) {
        if (!has(header)) continue;
        const date = toIsoDateCell(record[header]);
        if (date === null) messages.push(`${header}は 2026/4/1 の形で入力してください。`);
        else values[key] = date || null;
    }

    if (has('点検の周期（月）')) {
        const text = record['点検の周期（月）'];
        const months = Number(text);
        if (text === '') values.inspection_interval_months = null;
        else if (!Number.isInteger(months) || months < 1 || months > 120) {
            messages.push('点検の周期（月）は 1〜120 の整数で入力してください。');
        } else values.inspection_interval_months = months;
    }

    // 状態が空なら、新規は「良好」、更新は今のまま
    const stateText = has('状態') ? record['状態'] : '';
    let state = existing?.state ?? 'good';
    if (stateText) {
        if (!STATE_VALUES[stateText]) messages.push('状態は「良好」か「不良」で入力してください。');
        else state = STATE_VALUES[stateText];
        values.state = state;
    }
    if (state === 'good') {
        // 良好なら不良ランク・不良内容は空にする
        if (stateText) {
            values.defect_rank = null;
            values.defect_note = null;
        }
    } else {
        if (has('不良ランク')) {
            const rank = record['不良ランク'];
            if (rank && !DEFECT_RANK_VALUES[rank]) {
                messages.push(`不良ランクは ${Object.values(DEFECT_RANK_LABELS).join(' / ')} のどれかにしてください。`);
            } else values.defect_rank = rank ? DEFECT_RANK_VALUES[rank] : null;
        }
        if (has('不良内容')) values.defect_note = record['不良内容'] || null;
    }

    return { id, values, messages };
};

router.post('/tools/import', receive, async (req, res) => {
    const file = readUpload(req, ['工具ID']);
    if (file.error) return res.status(400).send(file.error);
    const dryRun = req.query.dryRun === '1';

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [current] = await conn.query('SELECT id, state, active FROM tools FOR UPDATE');
        const byId = new Map(current.map((t) => [t.id, t]));
        const seen = new Set();

        const rows = file.records.map((record) => {
            const existing = byId.get(record['工具ID']);
            const row = toToolRow(record, file.headers, existing);
            if (row.id && seen.has(row.id)) row.messages.push('同じ工具IDの行が他にもあります。');
            seen.add(row.id);
            if (existing && !existing.active) {
                row.messages.push('無効化した工具です。先に「元に戻す」をしてください。');
            }
            return {
                line: record.line,
                id: row.id,
                name: row.values.name ?? '',
                action: row.messages.length > 0 ? 'error' : existing ? 'update' : 'create',
                messages: row.messages,
                values: row.values,
            };
        });
        const summary = summarize(rows);
        const report = rows.map(({ values, ...rest }) => rest);

        if (dryRun || summary.error > 0) {
            await conn.rollback();
            return res.status(dryRun ? 200 : 400).json({ committed: false, summary, rows: report });
        }

        for (const row of rows) {
            const columns = Object.keys(row.values);
            if (row.action === 'create') {
                await conn.query(
                    `INSERT INTO tools (id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`,
                    [row.id, ...columns.map((c) => row.values[c])]
                );
            } else if (columns.length > 0) {
                await withToolChangeLog(conn, { toolId: row.id, employeeId: req.user.id, source: 'import' }, () =>
                    conn.query(`UPDATE tools SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
                        ...columns.map((c) => row.values[c]),
                        row.id,
                    ])
                );
            }
        }
        await conn.commit();
        res.json({ committed: true, summary, rows: report });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('工具の取り込みに失敗しました。');
    } finally {
        conn.release();
    }
});

/* ---------------- 社員の一括登録・更新 ---------------- */

const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

const toEmployeeRow = (record, headers, existing, actor) => {
    const messages = [];
    const has = (h) => headers.includes(h);
    const id = record['社員ID'];
    const values = {};

    if (!id) messages.push('社員IDが空です。');
    else if (!EMPLOYEE_ID_PATTERN.test(id)) {
        messages.push('社員IDは半角の英数字・ハイフン・アンダーバー（32文字まで）にしてください。');
    }

    if (has('社員名')) {
        if (!record['社員名']) messages.push('社員名が空です。');
        else if (record['社員名'].length > 64) messages.push('社員名は 64 文字までです。');
        else values.name = record['社員名'];
    } else if (!existing) {
        messages.push('新しい社員には「社員名」の列が必要です。');
    }

    if (has('所属班')) {
        if (record['所属班'].length > 64) messages.push('所属班は 64 文字までです。');
        else values.team = record['所属班'] || null;
    }
    if (has('血液型')) {
        if (record['血液型'].length > 8) messages.push('血液型は 8 文字までです。');
        else values.blood_type = record['血液型'] || null;
    }

    // 権限が空なら、新規は「一般」、更新は今のまま
    const permission = has('権限') ? record['権限'] : '';
    if (permission) {
        if (!ROLES.includes(permission)) messages.push(`権限は ${ROLES.join(' / ')} のどれかにしてください。`);
        else if (id === actor.id && permission !== actor.permission) {
            messages.push('自分自身の権限は変更できません。');
        } else values.permission = permission;
    } else if (!existing) {
        values.permission = MEMBER;
    }

    // 初期パスワードは、新規は必須。更新のときは入っている行だけ初期化する。
    const password = has('初期パスワード') ? record['初期パスワード'] : '';
    if (password) {
        const invalid = validatePassword(password, id);
        if (invalid) messages.push(invalid.replace('パスワード', '初期パスワード'));
    } else if (!existing) {
        messages.push('新しい社員には初期パスワードが必要です。');
    }

    return { id, values, password, messages };
};

router.post('/employees/import', receive, async (req, res) => {
    const file = readUpload(req, ['社員ID']);
    if (file.error) return res.status(400).send(file.error);
    const dryRun = req.query.dryRun === '1';

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [current] = await conn.query('SELECT id, active FROM employees FOR UPDATE');
        const byId = new Map(current.map((e) => [e.id, e]));
        const seen = new Set();

        const rows = file.records.map((record) => {
            const existing = byId.get(record['社員ID']);
            const row = toEmployeeRow(record, file.headers, existing, req.user);
            if (row.id && seen.has(row.id)) row.messages.push('同じ社員IDの行が他にもあります。');
            seen.add(row.id);
            if (existing && !existing.active) {
                row.messages.push('無効化した社員です。先に「元に戻す」をしてください。');
            }
            return {
                line: record.line,
                id: row.id,
                name: row.values.name ?? '',
                action: row.messages.length > 0 ? 'error' : existing ? 'update' : 'create',
                passwordReset: Boolean(existing && row.password),
                messages: row.messages,
                values: row.values,
                password: row.password,
            };
        });
        const summary = summarize(rows);
        const report = rows.map(({ values, password, ...rest }) => rest);

        if (dryRun || summary.error > 0) {
            await conn.rollback();
            return res.status(dryRun ? 200 : 400).json({ committed: false, summary, rows: report });
        }

        for (const row of rows) {
            const values = { ...row.values };
            if (row.password) {
                values.password_hash = await bcrypt.hash(row.password, 10);
                values.must_change_password = 1;
            }
            const columns = Object.keys(values);
            if (row.action === 'create') {
                await conn.query(
                    `INSERT INTO employees (id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})`,
                    [row.id, ...columns.map((c) => values[c])]
                );
            } else if (columns.length > 0) {
                // パスワードを初期化したときは、発行済みのトークンとロックも無効にする
                const extra = row.password
                    ? ', token_version = token_version + 1, failed_logins = 0, locked_until = NULL'
                    : '';
                await conn.query(
                    `UPDATE employees SET ${columns.map((c) => `${c} = ?`).join(', ')}${extra} WHERE id = ?`,
                    [...columns.map((c) => values[c]), row.id]
                );
            }
        }
        await conn.commit();
        res.json({ committed: true, summary, rows: report });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('社員の取り込みに失敗しました。');
    } finally {
        conn.release();
    }
});

module.exports = router;
