const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/pool').promise;
const { authenticate } = require('../middleware/auth');

// 社員ID + パスワードでログインし JWT を発行する
router.post('/login', async (req, res) => {
    const { id, password } = req.body;
    if (!id || !password) return res.status(400).send('社員IDとパスワードを入力してください。');

    try {
        const [rows] = await db.query('SELECT * FROM employees WHERE id = ?', [id]);
        const employee = rows[0];
        if (!employee) return res.status(401).send('社員IDまたはパスワードが違います。');

        const ok = await bcrypt.compare(password, employee.password_hash);
        if (!ok) return res.status(401).send('社員IDまたはパスワードが違います。');

        const token = jwt.sign(
            { id: employee.id, name: employee.name, permission: employee.permission },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            token,
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

// トークンの有効性確認（参照元の /auth/check 相当）
router.post('/check', authenticate, (req, res) => {
    res.json({ ok: true, user: req.user });
});

module.exports = router;
