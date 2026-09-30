const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const db = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, cb) => {
            // curl や同一オリジンからのアクセスは origin が無い
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            cb(new Error('CORS: 許可されていないオリジンです'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);
// アクセスログ（参照元と同じく短縮ログと詳細ログの2本立て）
const logDir = 'logs';
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

app.use((req, res, next) => {
    const dateTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const shortLogFilePath = path.join(logDir, 'short-log.txt');
    const logFilePath = path.join(logDir, 'detailed-log.txt');

    const originalSend = res.send;

    res.send = function (body) {
        // パスワードやトークンはログに残さない
        const safeBody = { ...req.body };
        if (safeBody.password) safeBody.password = '***';
        const safeHeaders = { ...req.headers };
        if (safeHeaders.authorization) safeHeaders.authorization = '***';

        const logMessage = `
[${dateTime}]
  Request Details:
  Method: ${req.method}
  URL: ${req.originalUrl}
  Headers: ${JSON.stringify(safeHeaders)}
  Query Parameters: ${JSON.stringify(req.query)}
  Body: ${JSON.stringify(safeBody)}
  Remote Address: ${req.ip}
  User Agent: ${req.get('User-Agent')}

  Response:
  Status: ${res.statusCode}
---------------------------------------------
`;
        const shortLogMessage = `[${dateTime}] ${req.method} ${req.originalUrl} ${res.statusCode} [${req.ip}]`;
        console.log(shortLogMessage);
        fs.appendFile(shortLogFilePath, `${shortLogMessage}\n`, (err) => {
            if (err) console.error('ログの書き込みエラー (short):', err);
        });
        fs.appendFile(logFilePath, logMessage, (err) => {
            if (err) console.error('ログの書き込みエラー (detailed):', err);
        });
        return originalSend.call(this, body);
    };
    next();
});

// ルーティングは既存 API への組み込みと共通（router.js）
app.use(require('./router').api);

// CORS のエラーを拾う（ルート内のエラーは router.js 側で処理する）
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).send(err.message || 'サーバーエラーが発生しました。');
});

db.getConnection((err, conn) => {
    if (err) {
        console.error('MySQL への接続に失敗しました:', err.message);
        process.exit(1);
    }
    console.log('Connected to MySQL');
    conn.release();

    // 証明書が設定されていれば HTTPS、無ければ HTTP で起動する
    const useHttps = process.env.KEY_PATH && process.env.CERT_PATH;
    const server = useHttps
        ? require('https').createServer(
              {
                  key: fs.readFileSync(process.env.KEY_PATH),
                  cert: fs.readFileSync(process.env.CERT_PATH),
              },
              app
          )
        : require('http').createServer(app);

    server.listen(PORT, () => {
        console.log(`Server running on ${useHttps ? 'https' : 'http'}://localhost:${PORT}`);
    });
});
