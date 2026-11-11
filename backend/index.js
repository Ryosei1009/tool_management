const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const db = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 4000;

// JWT の秘密鍵が未設定・ひな形のままだと、誰でもトークンを作れてしまうので起動しない
const secret = process.env.TM_JWT_SECRET || process.env.JWT_SECRET;
if (!secret || secret === 'change-me-to-a-long-random-string' || secret.length < 16) {
    console.error('JWT_SECRET が設定されていません。.env に 16 文字以上のランダムな文字列を設定してください。');
    process.exit(1);
}

// 前段にリバースプロキシ（nginx など）を置くときは TRUST_PROXY=1 にすると、
// 操作ログの IP アドレスが接続元のものになる。
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.disable('x-powered-by');

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, cb) => {
            // curl や同一オリジンからのアクセスは origin が無い
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            const err = new Error('CORS: 許可されていないオリジンです');
            err.status = 403;
            cb(err);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        // CSV をダウンロードするとき、フロントがファイル名を読めるようにする
        exposedHeaders: ['Content-Disposition'],
    })
);

// ルーティングと操作ログは既存 API への組み込みと共通（router.js）
app.use(require('./router').api);

// CORS のエラーを拾う（ルート内のエラーは router.js 側で処理する）
app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).send(status >= 500 ? 'サーバーエラーが発生しました。' : err.message);
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
