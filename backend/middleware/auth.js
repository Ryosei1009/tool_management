const jwt = require('jsonwebtoken');

// Authorization ヘッダーの JWT を検証して req.user に載せる。
// 参照元に合わせ、"Bearer xxx" と生トークンの両方を受け付ける。
const authenticate = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).send('無許可');

    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    jwt.verify(token, process.env.TM_JWT_SECRET || process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).send('無許可');
        req.user = decoded;
        next();
    });
};

// 管理者のみ許可する
const requireAdmin = (req, res, next) => {
    if (req.user?.permission !== '管理者') return res.status(403).send('権限がありません');
    next();
};

module.exports = { authenticate, requireAdmin };
