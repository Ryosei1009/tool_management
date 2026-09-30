const express = require('express');
const router = express.Router();
const db = require('../db/pool').promise;
const { authenticate } = require('../middleware/auth');
const { toToolResponse } = require('../utils/format');

const RENTAL_SELECT = `
    SELECT t.*,
           r.id         AS rental_id,
           r.start_date, r.end_date, r.reserved,
           e.id         AS user_id,
           e.name       AS user_name
      FROM rentals r
      JOIN tools t      ON t.id = r.tool_id
      JOIN employees e  ON e.id = r.employee_id
     WHERE r.status = 'renting'
`;

// 借りているものリスト（ログイン中の社員のもの）
router.get('/mine', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(`${RENTAL_SELECT} AND r.employee_id = ? ORDER BY r.end_date`, [
            req.user.id,
        ]);
        res.json(rows.map(toToolResponse));
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 貸出中の全件（管理者向けの一覧用）
router.get('/get', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(`${RENTAL_SELECT} ORDER BY r.end_date`);
        res.json(rows.map(toToolResponse));
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

// 借りる。pin を渡すと工具の置き場所もそこへ移す
// （借りる画面の初期値は借りる人のデフォルトのピン位置）。
router.post('/create', authenticate, async (req, res) => {
    const { toolId, startDate, endDate, reserved, pin } = req.body;
    if (!toolId || !startDate || !endDate) {
        return res.status(400).send('工具IDと期間は必須です。');
    }
    if (startDate > endDate) return res.status(400).send('返却日は貸出日より後にしてください。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [tools] = await conn.query('SELECT id FROM tools WHERE id = ?', [toolId]);
        if (tools.length === 0) {
            await conn.rollback();
            return res.status(404).send('該当する工具がありません。');
        }

        const [result] = await conn.query(
            `INSERT INTO rentals (tool_id, employee_id, start_date, end_date, reserved)
             VALUES (?, ?, ?, ?, ?)`,
            [toolId, req.user.id, startDate, endDate, reserved ? 1 : 0]
        );

        if (pin) {
            await conn.query('UPDATE tools SET pin_x = ?, pin_y = ? WHERE id = ?', [
                pin.x,
                pin.y,
                toolId,
            ]);
        }

        await conn.commit();
        res.status(201).json({ rentalId: result.insertId });
    } catch (err) {
        await conn.rollback();
        // active_tool_id の UNIQUE 制約に当たった＝既に誰かが借りている
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).send('その工具は既に貸出中です。');
        console.error(err);
        res.status(500).send('貸出処理に失敗しました。');
    } finally {
        conn.release();
    }
});

// 返す
router.post('/return', authenticate, async (req, res) => {
    const { rentalId, state } = req.body;
    if (!rentalId) return res.status(400).send('貸出IDは必須です。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT * FROM rentals WHERE id = ? AND status = 'renting' FOR UPDATE`,
            [rentalId]
        );
        const rental = rows[0];
        if (!rental) {
            await conn.rollback();
            return res.status(404).send('貸出中の記録が見つかりません。');
        }
        if (rental.employee_id !== req.user.id && req.user.permission !== '管理者') {
            await conn.rollback();
            return res.status(403).send('自分が借りた工具のみ返却できます。');
        }

        await conn.query(
            `UPDATE rentals SET status = 'returned', returned_at = NOW() WHERE id = ?`,
            [rentalId]
        );
        // 返却時に状態（良好/不良/破損）も更新できる
        if (state) {
            await conn.query('UPDATE tools SET state = ? WHERE id = ?', [state, rental.tool_id]);
        }

        await conn.commit();
        res.json({ rentalId, toolId: rental.tool_id });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('返却処理に失敗しました。');
    } finally {
        conn.release();
    }
});

// 更新（期間の延長 + 工具の状態・置き場所の更新）
router.post('/renew', authenticate, async (req, res) => {
    const { rentalId, startDate, endDate, state, pin } = req.body;
    if (!rentalId) return res.status(400).send('貸出IDは必須です。');
    if (startDate && endDate && startDate > endDate) {
        return res.status(400).send('返却日は貸出日より後にしてください。');
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT * FROM rentals WHERE id = ? AND status = 'renting' FOR UPDATE`,
            [rentalId]
        );
        const rental = rows[0];
        if (!rental) {
            await conn.rollback();
            return res.status(404).send('貸出中の記録が見つかりません。');
        }
        if (rental.employee_id !== req.user.id && req.user.permission !== '管理者') {
            await conn.rollback();
            return res.status(403).send('自分が借りた工具のみ更新できます。');
        }

        await conn.query(
            `UPDATE rentals
                SET start_date = COALESCE(?, start_date),
                    end_date   = COALESCE(?, end_date)
              WHERE id = ?`,
            [startDate || null, endDate || null, rentalId]
        );

        if (state || pin) {
            await conn.query(
                `UPDATE tools
                    SET state = COALESCE(?, state),
                        pin_x = COALESCE(?, pin_x),
                        pin_y = COALESCE(?, pin_y)
                  WHERE id = ?`,
                [state ?? null, pin?.x ?? null, pin?.y ?? null, rental.tool_id]
            );
        }

        await conn.commit();
        res.json({ rentalId });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('更新処理に失敗しました。');
    } finally {
        conn.release();
    }
});

// 渡す（別の社員へ貸出を引き継ぐ）。
// 元の貸出を返却扱いにして、渡し先の社員で新しい貸出を作る。
router.post('/transfer', authenticate, async (req, res) => {
    const { rentalId, toEmployeeId } = req.body;
    if (!rentalId || !toEmployeeId) return res.status(400).send('貸出IDと渡す相手は必須です。');

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `SELECT * FROM rentals WHERE id = ? AND status = 'renting' FOR UPDATE`,
            [rentalId]
        );
        const rental = rows[0];
        if (!rental) {
            await conn.rollback();
            return res.status(404).send('貸出中の記録が見つかりません。');
        }
        if (rental.employee_id !== req.user.id && req.user.permission !== '管理者') {
            await conn.rollback();
            return res.status(403).send('自分が借りた工具のみ渡せます。');
        }
        if (rental.employee_id === toEmployeeId) {
            await conn.rollback();
            return res.status(400).send('自分自身には渡せません。');
        }

        const [employees] = await conn.query(
            'SELECT id, default_pin_x, default_pin_y FROM employees WHERE id = ?',
            [toEmployeeId]
        );
        if (employees.length === 0) {
            await conn.rollback();
            return res.status(404).send('渡す相手の社員が見つかりません。');
        }

        // 渡し先がデフォルトの置き場所を持っていれば、工具もそこへ移す
        const to = employees[0];
        if (to.default_pin_x !== null && to.default_pin_y !== null) {
            await conn.query('UPDATE tools SET pin_x = ?, pin_y = ? WHERE id = ?', [
                to.default_pin_x,
                to.default_pin_y,
                rental.tool_id,
            ]);
        }

        await conn.query(
            `UPDATE rentals SET status = 'returned', returned_at = NOW() WHERE id = ?`,
            [rentalId]
        );
        const [result] = await conn.query(
            `INSERT INTO rentals (tool_id, employee_id, start_date, end_date, reserved)
             VALUES (?, ?, CURDATE(), ?, ?)`,
            [rental.tool_id, toEmployeeId, rental.end_date, rental.reserved]
        );

        await conn.commit();
        res.status(201).json({ rentalId: result.insertId, toolId: rental.tool_id });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send('引き渡し処理に失敗しました。');
    } finally {
        conn.release();
    }
});

module.exports = router;
