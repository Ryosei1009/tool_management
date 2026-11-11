const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/pool').promise;
const { authenticate, signToken } = require('../middleware/auth');
const { validatePassword } = require('../utils/password');
const { nowJst, addMinutesJst } = require('../utils/time');

// 5回続けて間違えると 15 分ロックする（時間がたてば自動で解ける。管理者・班長は手動でも解除できる）
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const WRONG = '社員IDまたはパスワードが違います。';

// 存在しない社員IDでも応答時間が変わらないよう、ダミーのハッシュと比べる
const DUMMY_HASH = bcrypt.hashSync('dummy-password-0', 10);

// 社員ID + パスワードでログインし JWT を発行する
router.post('/login', async (req, res) => {
    const { id, password } = req.body ?? {};
    if (!id || !password || typeof id !== 'string' || typeof password !== 'string') {
        return res.status(400).send('社員IDとパスワードを入力してください。');
    }

    try {
        const [rows] = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
        const employee = rows[0];
        if (!employee || !employee.active) {
            await bcrypt.compare(password, DUMMY_HASH);
            return res.status(401).send(WRONG);
        }

        const now = nowJst();
        const locked = employee.locked_until && String(employee.locked_until) > now;
        if (locked) {
            return res
                .status(423)
                .send(
                    `パスワードを${MAX_FAILURES}回間違えたため、ロックされています。` +
                        `${String(employee.locked_until).slice(11, 16)} 以降にもう一度試すか、管理者・班長に解除を依頼してください。`
                );
        }

        const ok = await bcrypt.compare(password, employee.password_hash);
        if (!ok) {
            // ロックが明けたあとの失敗は 1 回目から数え直す
            const failures = (employee.locked_until ? 0 : employee.failed_logins) + 1;
            if (failures >= MAX_FAILURES) {
                await db.query('UPDATE employees SET failed_logins = 0, locked_until = ? WHERE id = ?', [
                    addMinutesJst(now, LOCK_MINUTES),
                    employee.id,
                ]);
                return res
                    .status(423)
                    .send(`パスワードを${MAX_FAILURES}回間違えたため、${LOCK_MINUTES}分間ロックしました。`);
            }
            await db.query('UPDATE employees SET failed_logins = ?, locked_until = NULL WHERE id = ?', [
                failures,
                employee.id,
            ]);
            return res.status(401).send(`${WRONG}（あと ${MAX_FAILURES - failures} 回でロックされます）`);
        }

        // ルールを満たさない古いパスワード（初期パスワードなど）は、ログイン後すぐに変更させる
        const mustChange =
            Boolean(employee.must_change_password) || validatePassword(password, employee.id) !== null;
        await db.query(
            'UPDATE employees SET failed_logins = 0, locked_until = NULL, must_change_password = ? WHERE id = ?',
            [mustChange ? 1 : 0, employee.id]
        );

        res.json({
            token: signToken(employee),
            mustChangePassword: mustChange,
            employee: {
                id: employee.id,
                name: employee.name,
                team: employee.team,
                permission: employee.permission,
                photoUrl: employee.photo_url,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('ログインに失敗しました。');
    }
});

// トークンの有効性確認
router.post('/check', authenticate, (req, res) => {
    res.json({ ok: true, user: req.user });
});

module.exports = router;
module.exports.MAX_FAILURES = MAX_FAILURES;
module.exports.LOCK_MINUTES = LOCK_MINUTES;
