const jwt = require('jsonwebtoken');
const db = require('../db/pool').promise;
const { isAdmin, isLeader } = require('../utils/roles');
const { loadMapConfig } = require('../utils/map');

const getSecret = () => process.env.TM_JWT_SECRET || process.env.JWT_SECRET;

// トークンの有効期間。期限内でも、無効化・パスワード変更・権限変更はリクエストごとに DB で確かめる。
const TOKEN_EXPIRES_IN = '30d';

// トークンに入れるのは社員IDと token_version だけ（名前・班・権限は毎回 DB から取る）
const signToken = (employee) =>
    jwt.sign({ id: employee.id, v: employee.token_version ?? 0 }, getSecret(), { expiresIn: TOKEN_EXPIRES_IN });

// パスワードの変更が済むまでは、これ以外の API を使えない
const ALLOWED_BEFORE_PASSWORD_CHANGE = ['/auth/check', '/employees/me', '/employees/password', '/settings/map'];

// Authorization ヘッダーの JWT を検証して req.user に載せる。
// "Bearer xxx" と生トークンの両方を受け付ける。
// 権限を外した・無効化した・パスワードを変えた、がすぐ反映されるよう、社員の行を毎回確かめる。
const authenticate = async (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).send('ログインしてください。');
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    let decoded;
    try {
        decoded = jwt.verify(token, getSecret());
    } catch {
        return res.status(401).send('ログインの有効期限が切れました。もう一度ログインしてください。');
    }

    try {
        const [rows] = await db.query(
            `SELECT id, name, team, permission, active, token_version, must_change_password
               FROM employees WHERE id = ?`,
            [decoded.id]
        );
        const employee = rows[0];
        if (!employee || !employee.active) return res.status(401).send('このアカウントは使えません。');
        if ((decoded.v ?? 0) !== employee.token_version) {
            return res.status(401).send('パスワードが変更されました。もう一度ログインしてください。');
        }

        req.user = {
            id: employee.id,
            name: employee.name,
            team: employee.team,
            permission: employee.permission,
            mustChangePassword: Boolean(employee.must_change_password),
        };

        const path = `${req.baseUrl}${req.path}`.replace(/\/+$/, '');
        if (req.user.mustChangePassword && !ALLOWED_BEFORE_PASSWORD_CHANGE.some((p) => path.endsWith(p))) {
            return res.status(403).send('先にパスワードを変更してください。');
        }

        await loadMapConfig(db);
        next();
    } catch (err) {
        console.error(err);
        res.status(500).send('認証の確認に失敗しました。');
    }
};

// 管理者のみ許可する
const requireAdmin = (req, res, next) => {
    if (!isAdmin(req.user)) return res.status(403).send('権限がありません');
    next();
};

// 管理者か班長のみ許可する
const requireLeader = (req, res, next) => {
    if (!isAdmin(req.user) && !isLeader(req.user)) return res.status(403).send('権限がありません');
    next();
};

module.exports = { authenticate, requireAdmin, requireLeader, signToken };
