// 操作ログ。「いつ・誰が・何をして・どうなったか」を1行で残す。
// ・リクエストの本文やヘッダーは残さない（パスワードや個人情報を溜めないため）
// ・ファイルは日ごとに分け（logs/access-YYYY-MM-DD.log）、保存期間を過ぎたものは自動で消す
const fs = require('fs');
const path = require('path');
const { nowJst } = require('./time');

const LOG_DIR = process.env.TM_LOG_DIR || path.join(__dirname, '../logs');
const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS || 90);
const FILE_PATTERN = /^access-(\d{4}-\d{2}-\d{2})\.log$/;

let cleanedOn = '';

// 保存期間を過ぎた日のログを消す（1日1回）
const cleanup = (today) => {
    if (cleanedOn === today) return;
    cleanedOn = today;
    const limit = new Date(`${today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() - RETENTION_DAYS);
    const oldest = limit.toISOString().slice(0, 10);
    fs.readdir(LOG_DIR, (err, files) => {
        if (err) return;
        for (const file of files) {
            const m = FILE_PATTERN.exec(file);
            if (m && m[1] < oldest) fs.unlink(path.join(LOG_DIR, file), () => {});
        }
    });
};

// 検索語などは残さず、パスだけを記録する
const pathOnly = (url) => String(url ?? '').split('?')[0];

const accessLog = (req, res, next) => {
    if (process.env.TM_ACCESS_LOG === 'off') return next();
    const startedAt = Date.now();
    res.on('finish', () => {
        const now = nowJst();
        const today = now.slice(0, 10);
        const line = [
            now,
            req.user?.id ?? '-',
            req.method,
            pathOnly(req.originalUrl),
            res.statusCode,
            `${Date.now() - startedAt}ms`,
            req.ip ?? '-',
        ].join('\t');
        fs.mkdir(LOG_DIR, { recursive: true }, () => {
            fs.appendFile(path.join(LOG_DIR, `access-${today}.log`), `${line}\n`, (err) => {
                if (err) console.error('操作ログを書き込めませんでした:', err.message);
            });
            cleanup(today);
        });
    });
    next();
};

module.exports = { accessLog, RETENTION_DAYS };
