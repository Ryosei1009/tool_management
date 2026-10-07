const express = require('express');
const router = express.Router();
const db = require('../db/pool').promise;
const { authenticate } = require('../middleware/auth');
const { toToolResponse, toRangeLabel } = require('../utils/format');
const { canActFor } = require('../utils/permission');
const { withToolChangeLog } = require('../utils/changeLog');
const { currentSlot, isPeriod, nowJst, overlaps, rentalRange, slotKey } = require('../utils/time');

const STATES = ['good', 'bad'];
const DEFECT_RANKS = ['minor', 'repair', 'replace', 'waiting'];

const RENTAL_SELECT = `
    SELECT t.*,
           r.id         AS rental_id,
           r.status     AS rental_status,
           r.start_date, r.start_period, r.end_date, r.end_period,
           r.taken_at, r.taken_by,
           e.id         AS user_id,
           e.name       AS user_name,
           e.team       AS user_team,
           tb.name      AS taken_by_name
      FROM rentals r
      JOIN tools t      ON t.id = r.tool_id
      JOIN employees e  ON e.id = r.employee_id
      LEFT JOIN employees tb ON tb.id = r.taken_by
     WHERE r.status IN ('renting', 'reserved')
`;

// 貸出中を先に、それぞれ返却予定（予約は開始）の早い順
const RENTAL_ORDER = `
    ORDER BY r.status = 'reserved', r.end_date, r.end_period, r.start_date, r.start_period, r.id
`;

// 借りているもの・予約しているもの
//   ?scope=team … 同じ班のメンバーの分（代理で返却・延長するため）。自分の分も含む。
router.get('/mine', authenticate, async (req, res) => {
    try {
        let rows;
        if (req.query.scope === 'team') {
            [rows] = await db.query(
                `${RENTAL_SELECT}
                   AND e.team IS NOT NULL AND e.team <> ''
                   AND e.team = (SELECT team FROM employees WHERE id = ?)
                 ${RENTAL_ORDER}`,
                [req.user.id]
            );
        } else {
            [rows] = await db.query(`${RENTAL_SELECT} AND r.employee_id = ? ${RENTAL_ORDER}`, [req.user.id]);
        }
        res.json(rows.map(toToolResponse));
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 貸出中・予約中の全件（管理者向けの一覧用）
router.get('/get', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(`${RENTAL_SELECT} ${RENTAL_ORDER}`);
        res.json(rows.map(toToolResponse));
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// ---------- 共通処理 ----------

// 処理を中断して、指定のステータス・文言で返すための例外
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// 期間の値を確かめて { start, end }（slotKey）を返す
const toRange = ({ startDate, startPeriod, endDate, endPeriod }) => {
    if (!startDate || !endDate) throw new HttpError(400, '期間を入力してください。');
    if (!isPeriod(startPeriod) || !isPeriod(endPeriod)) {
        throw new HttpError(400, '午前・午後を選んでください。');
    }
    const range = { start: slotKey(startDate, startPeriod), end: slotKey(endDate, endPeriod) };
    if (range.start > range.end) throw new HttpError(400, '返却予定は貸出開始より後にしてください。');
    return range;
};

// 同じ工具の他の予約・貸出と期間が重なっていないか確かめる。重なっていれば 409。
// exceptIds の行（自分自身）は比べない。
const assertNoOverlap = async (conn, toolId, range, exceptIds = []) => {
    const [rows] = await conn.query(
        `SELECT r.*, e.name AS user_name
           FROM rentals r
           JOIN employees e ON e.id = r.employee_id
          WHERE r.tool_id = ? AND r.status IN ('reserved', 'renting')
          FOR UPDATE`,
        [toolId]
    );
    const now = currentSlot();
    const conflicts = rows.filter((r) => !exceptIds.includes(r.id) && overlaps(range, rentalRange(r, now)));
    if (conflicts.length === 0) return;

    const detail = conflicts
        .map((r) => `${r.status === 'renting' ? '貸出中' : '予約'}：${toRangeLabel(r)}（${r.user_name}）`)
        .join('\n');
    throw new HttpError(409, `期間が他の予約・貸出と重なっています。\n${detail}`);
};

// 状態・不良内容の更新（返却・延長・持ち出し時）。渡されなければ何もしない。
const updateToolCondition = async (conn, toolId, { state, defectRank, defectNote, pin }) => {
    if (state !== undefined && state !== null && !STATES.includes(state)) {
        throw new HttpError(400, '状態の値が正しくありません。');
    }
    if (defectRank && !DEFECT_RANKS.includes(defectRank)) {
        throw new HttpError(400, '不良ランクの値が正しくありません。');
    }
    const sets = [];
    const params = [];
    if (state) {
        sets.push('state = ?', 'defect_rank = ?', 'defect_note = ?');
        params.push(state, state === 'good' ? null : defectRank || null, state === 'good' ? null : defectNote || null);
    }
    if (pin) {
        sets.push('pin_x = ?', 'pin_y = ?');
        params.push(pin.x, pin.y);
    }
    if (sets.length === 0) return;
    await conn.query(`UPDATE tools SET ${sets.join(', ')} WHERE id = ?`, [...params, toolId]);
};

// 貸出・予約の1行をロックして取り、操作してよいか（本人・同じ班・管理者）確かめる
const lockRental = async (conn, rentalId, user, statuses) => {
    const [rows] = await conn.query(
        `SELECT * FROM rentals WHERE id = ? AND status IN (?) FOR UPDATE`,
        [rentalId, statuses]
    );
    const rental = rows[0];
    if (!rental) throw new HttpError(404, '対象の貸出・予約が見つかりません。');
    if (!(await canActFor(conn, user, rental.employee_id))) {
        throw new HttpError(403, '本人か、同じ班のメンバーのみ操作できます。');
    }
    return rental;
};

// トランザクションの定型。HttpError はその文言で返す。
const transaction = (failMessage, handler) => async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const result = await handler(conn, req);
        await conn.commit();
        res.status(result.status ?? 200).json(result.body);
    } catch (err) {
        await conn.rollback();
        if (err instanceof HttpError) return res.status(err.status).send(err.message);
        // active_tool_id の UNIQUE 制約に当たった＝既に誰かが借りている
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('その工具は既に貸出中です。');
        console.error(err);
        res.status(500).send(failMessage);
    } finally {
        conn.release();
    }
};

// ---------- 借りる・予約する ----------

// mode='rent'    … 今すぐ持ち出す。開始は現在（日時を記録）、返却予定は日付 + 午前/午後
// mode='reserve' … 予約する。開始・返却予定とも日付 + 午前/午後
// employeeId を渡すと、その人の代理で借りる（同じ班のメンバーのみ）。
// pin を渡すと、工具の持ち出し場所もそこへ移す（今すぐ借りるときのみ）。
router.post(
    '/create',
    authenticate,
    transaction('貸出処理に失敗しました。', async (conn, req) => {
        const { toolId, mode = 'rent', endDate, endPeriod, pin, employeeId } = req.body;
        if (!toolId) throw new HttpError(400, '工具IDは必須です。');
        if (mode !== 'rent' && mode !== 'reserve') throw new HttpError(400, '借り方の指定が正しくありません。');

        const borrowerId = employeeId || req.user.id;
        if (!(await canActFor(conn, req.user, borrowerId))) {
            throw new HttpError(403, '代理で借りられるのは同じ班のメンバーの分だけです。');
        }
        const [borrowers] = await conn.query('SELECT id FROM employees WHERE id = ?', [borrowerId]);
        if (borrowers.length === 0) throw new HttpError(404, '借りる人が見つかりません。');

        const [tools] = await conn.query('SELECT id FROM tools WHERE id = ? FOR UPDATE', [toolId]);
        if (tools.length === 0) throw new HttpError(404, '該当する工具がありません。');

        const now = currentSlot();
        const nowKey = slotKey(now.date, now.period);

        if (mode === 'reserve') {
            const { startDate, startPeriod } = req.body;
            const range = toRange({ startDate, startPeriod, endDate, endPeriod });
            if (range.start < nowKey) throw new HttpError(400, '過去の日時は予約できません。');
            await assertNoOverlap(conn, toolId, range);

            const [result] = await conn.query(
                `INSERT INTO rentals
                   (tool_id, employee_id, start_date, start_period, end_date, end_period, status, taken_by)
                 VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?)`,
                [toolId, borrowerId, startDate, startPeriod, endDate, endPeriod, req.user.id]
            );
            return { status: 201, body: { rentalId: result.insertId, status: 'reserved' } };
        }

        const range = toRange({ startDate: now.date, startPeriod: now.period, endDate, endPeriod });

        // 借りる人自身の予約と重なる場合は、その予約を使って持ち出す（予約は貸出に切り替わる）
        const [ownReservations] = await conn.query(
            `SELECT * FROM rentals
              WHERE tool_id = ? AND employee_id = ? AND status = 'reserved'
              ORDER BY start_date, start_period FOR UPDATE`,
            [toolId, borrowerId]
        );
        const own = ownReservations.find((r) => overlaps(range, rentalRange(r, now)));
        await assertNoOverlap(conn, toolId, range, own ? [own.id] : []);

        const takenAt = nowJst();
        let rentalId;
        await withToolChangeLog(conn, { toolId, employeeId: req.user.id, source: 'rent' }, async () => {
            if (own) {
                await conn.query(
                    `UPDATE rentals
                        SET status = 'renting', start_date = ?, start_period = ?,
                            end_date = ?, end_period = ?, taken_at = ?, taken_by = ?
                      WHERE id = ?`,
                    [now.date, now.period, endDate, endPeriod, takenAt, req.user.id, own.id]
                );
                rentalId = own.id;
            } else {
                const [result] = await conn.query(
                    `INSERT INTO rentals
                       (tool_id, employee_id, start_date, start_period, end_date, end_period,
                        status, taken_at, taken_by)
                     VALUES (?, ?, ?, ?, ?, ?, 'renting', ?, ?)`,
                    [toolId, borrowerId, now.date, now.period, endDate, endPeriod, takenAt, req.user.id]
                );
                rentalId = result.insertId;
            }
            await updateToolCondition(conn, toolId, { pin });
        });

        return { status: 201, body: { rentalId, status: 'renting', usedReservation: Boolean(own) } };
    })
);

// 予約していた工具を持ち出す（予約 → 貸出）
router.post(
    '/start',
    authenticate,
    transaction('貸出処理に失敗しました。', async (conn, req) => {
        const { rentalId, endDate, endPeriod, pin } = req.body;
        if (!rentalId) throw new HttpError(400, '予約IDは必須です。');
        const rental = await lockRental(conn, rentalId, req.user, ['reserved']);

        const now = currentSlot();
        const end = endDate ?? String(rental.end_date).slice(0, 10);
        const endP = endPeriod ?? rental.end_period;
        const range = toRange({ startDate: now.date, startPeriod: now.period, endDate: end, endPeriod: endP });
        await assertNoOverlap(conn, rental.tool_id, range, [rental.id]);

        // 持ち出し場所は、指定がなければ借りる人の既定の持ち出し場所にする
        let movePin = pin;
        if (!movePin) {
            const [rows] = await conn.query(
                'SELECT default_pin_x AS x, default_pin_y AS y FROM employees WHERE id = ?',
                [rental.employee_id]
            );
            if (rows[0] && rows[0].x !== null && rows[0].y !== null) movePin = rows[0];
        }

        await withToolChangeLog(conn, { toolId: rental.tool_id, employeeId: req.user.id, source: 'rent' }, async () => {
            await conn.query(
                `UPDATE rentals
                    SET status = 'renting', start_date = ?, start_period = ?,
                        end_date = ?, end_period = ?, taken_at = ?, taken_by = ?
                  WHERE id = ?`,
                [now.date, now.period, end, endP, nowJst(), req.user.id, rental.id]
            );
            await updateToolCondition(conn, rental.tool_id, { pin: movePin });
        });

        return { body: { rentalId: rental.id, status: 'renting' } };
    })
);

// 予約の取り消し
router.post(
    '/cancel',
    authenticate,
    transaction('予約の取り消しに失敗しました。', async (conn, req) => {
        const { rentalId } = req.body;
        if (!rentalId) throw new HttpError(400, '予約IDは必須です。');
        const rental = await lockRental(conn, rentalId, req.user, ['reserved']);
        await conn.query(`UPDATE rentals SET status = 'cancelled', returned_by = ? WHERE id = ?`, [
            req.user.id,
            rental.id,
        ]);
        return { body: { rentalId: rental.id } };
    })
);

// 返す。返却時の状態（良好/不良）と不良内容も記録できる。
router.post(
    '/return',
    authenticate,
    transaction('返却処理に失敗しました。', async (conn, req) => {
        const { rentalId, state, defectRank, defectNote } = req.body;
        if (!rentalId) throw new HttpError(400, '貸出IDは必須です。');
        const rental = await lockRental(conn, rentalId, req.user, ['renting']);

        await withToolChangeLog(conn, { toolId: rental.tool_id, employeeId: req.user.id, source: 'return' }, async () => {
            await conn.query(
                `UPDATE rentals SET status = 'returned', returned_at = ?, returned_by = ? WHERE id = ?`,
                [nowJst(), req.user.id, rental.id]
            );
            await updateToolCondition(conn, rental.tool_id, { state, defectRank, defectNote });
        });

        return { body: { rentalId: rental.id, toolId: rental.tool_id } };
    })
);

// 更新（返却予定の変更 + 工具の状態・持ち出し場所の更新）。
// 予約の場合は開始日時も変えられる。他の予約と重なる期間には変更できない。
router.post(
    '/renew',
    authenticate,
    transaction('更新処理に失敗しました。', async (conn, req) => {
        const { rentalId, startDate, startPeriod, endDate, endPeriod, state, defectRank, defectNote, pin } = req.body;
        if (!rentalId) throw new HttpError(400, '貸出IDは必須です。');
        const rental = await lockRental(conn, rentalId, req.user, ['renting', 'reserved']);
        const isReserved = rental.status === 'reserved';

        // 貸出中の開始（持ち出し日時）は記録なので変えない
        const next = {
            startDate: isReserved && startDate ? startDate : String(rental.start_date).slice(0, 10),
            startPeriod: isReserved && startPeriod ? startPeriod : rental.start_period,
            endDate: endDate || String(rental.end_date).slice(0, 10),
            endPeriod: endPeriod || rental.end_period,
        };
        const range = toRange(next);
        if (isReserved) {
            const now = currentSlot();
            if (range.start < slotKey(now.date, now.period)) throw new HttpError(400, '過去の日時は予約できません。');
        }
        await assertNoOverlap(conn, rental.tool_id, range, [rental.id]);

        await withToolChangeLog(conn, { toolId: rental.tool_id, employeeId: req.user.id, source: 'renew' }, async () => {
            await conn.query(
                `UPDATE rentals
                    SET start_date = ?, start_period = ?, end_date = ?, end_period = ?
                  WHERE id = ?`,
                [next.startDate, next.startPeriod, next.endDate, next.endPeriod, rental.id]
            );
            // 予約中はまだ持ち出していないので、工具の状態・場所は変えない
            if (!isReserved) await updateToolCondition(conn, rental.tool_id, { state, defectRank, defectNote, pin });
        });

        return { body: { rentalId: rental.id } };
    })
);

// 渡す（別の社員へ貸出を引き継ぐ）。
// 元の貸出を返却扱いにして、渡し先の社員で新しい貸出を作る。
router.post(
    '/transfer',
    authenticate,
    transaction('引き渡し処理に失敗しました。', async (conn, req) => {
        const { rentalId, toEmployeeId } = req.body;
        if (!rentalId || !toEmployeeId) throw new HttpError(400, '貸出IDと渡す相手は必須です。');
        const rental = await lockRental(conn, rentalId, req.user, ['renting']);
        if (rental.employee_id === toEmployeeId) throw new HttpError(400, '今借りている人には渡せません。');

        const [employees] = await conn.query(
            'SELECT id, default_pin_x, default_pin_y FROM employees WHERE id = ?',
            [toEmployeeId]
        );
        if (employees.length === 0) throw new HttpError(404, '渡す相手の社員が見つかりません。');
        const to = employees[0];

        const now = currentSlot();
        const at = nowJst();
        let newId;
        await withToolChangeLog(conn, { toolId: rental.tool_id, employeeId: req.user.id, source: 'transfer' }, async () => {
            // 渡し先がデフォルトの持ち出し場所を持っていれば、工具もそこへ移す
            if (to.default_pin_x !== null && to.default_pin_y !== null) {
                await updateToolCondition(conn, rental.tool_id, {
                    pin: { x: to.default_pin_x, y: to.default_pin_y },
                });
            }
            await conn.query(
                `UPDATE rentals SET status = 'returned', returned_at = ?, returned_by = ? WHERE id = ?`,
                [at, req.user.id, rental.id]
            );
            const [result] = await conn.query(
                `INSERT INTO rentals
                   (tool_id, employee_id, start_date, start_period, end_date, end_period,
                    status, taken_at, taken_by)
                 VALUES (?, ?, ?, ?, ?, ?, 'renting', ?, ?)`,
                [rental.tool_id, toEmployeeId, now.date, now.period, rental.end_date, rental.end_period, at, req.user.id]
            );
            newId = result.insertId;
        });

        return { status: 201, body: { rentalId: newId, toolId: rental.tool_id } };
    })
);

module.exports = router;
