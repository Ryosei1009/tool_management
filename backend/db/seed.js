// フロントの仮データ（frontend/src/data/*.json）を DB に投入する。
//   使い方: npm run setup の後で  npm run seed
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./pool').promise;

const dataDir = path.resolve(__dirname, '../../frontend/src/data');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

// tools.json の user 欄に出てくる社員をそのまま登録する
const EMPLOYEES = [
    { id: 'E-12345', name: '山田 太郎', team: '第一製造班', bloodType: 'A型', permission: '管理者' },
    { id: 'E-12346', name: '佐藤 花子', team: '第一製造班', bloodType: 'O型', permission: '一般' },
    { id: 'E-12347', name: '鈴木 一郎', team: '第二製造班', bloodType: 'B型', permission: '一般' },
    { id: 'E-12348', name: '田中 次郎', team: '第二製造班', bloodType: 'AB型', permission: '一般' },
];
const DEFAULT_PASSWORD = 'password';

// 「1月2日」→ 今年の YYYY-MM-DD
const jpDateToIso = (value) => {
    const m = /^(\d+)月(\d+)日$/.exec((value ?? '').trim());
    if (!m) return null;
    const year = new Date().getFullYear();
    return `${year}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
};

const main = async () => {
    const tools = readJson('tools.json');
    const rentItems = readJson('rentItems.json');

    // 全削除してから入れ直すため、途中で失敗・中断しても「消えただけ」の
    // 状態が残らないよう、1つのトランザクションにまとめる。
    const conn = await db.getConnection();
    await conn.beginTransaction();

    try {
        // 外部キーがあるので子テーブルから消す
        await conn.query('DELETE FROM rentals');
        await conn.query('DELETE FROM tools');
        await conn.query('DELETE FROM employees');

        const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        for (const e of EMPLOYEES) {
            await conn.query(
                `INSERT INTO employees (id, name, team, blood_type, permission, photo_url, password_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [e.id, e.name, e.team, e.bloodType, e.permission, '/img/tmp/tmp_icon.png', hash]
            );
        }
        console.log(`社員 ${EMPLOYEES.length} 件を登録しました。`);

        for (const t of tools) {
            await conn.query(
                `INSERT INTO tools (id, name, category, photo_url, state, pin_x, pin_y, last_inspection_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    t.id,
                    t.name,
                    t.category ?? null,
                    t.photoUrl ?? null,
                    t.state ?? 'good',
                    t.pin?.x ?? null,
                    t.pin?.y ?? null,
                    t.lastInspectionDate || null,
                ]
            );
        }
        console.log(`工具 ${tools.length} 件を登録しました。`);

        // 「現在貸出中」の貸出を作る。
        // ・tools.json … 各工具の user / startDate / endDate（工具リスト画面のサンプル）
        // ・rentItems.json … 山田 太郎が借りているもの（借りているもの画面のサンプル）
        // 1つの工具は同時に1件しか貸出を持てないため、両方に出てくる工具
        // （A1 / B1 / D1 / G5）は rentItems.json の内容を優先する。
        const byName = new Map(EMPLOYEES.map((e) => [e.name, e.id]));
        const yamada = byName.get('山田 太郎');

        const rentals = new Map();
        for (const t of tools) {
            const employeeId = byName.get(t.user);
            const start = jpDateToIso(t.startDate);
            const end = jpDateToIso(t.endDate);
            if (!employeeId || !start || !end) continue;
            rentals.set(t.id, { toolId: t.id, employeeId, start, end });
        }
        for (const item of rentItems) {
            const start = jpDateToIso(item.startDate);
            const end = jpDateToIso(item.endDate);
            if (!start || !end) continue;
            rentals.set(item.id, { toolId: item.id, employeeId: yamada, start, end });
        }

        for (const r of rentals.values()) {
            await conn.query(
                `INSERT INTO rentals (tool_id, employee_id, start_date, end_date, status)
                 VALUES (?, ?, ?, ?, 'renting')`,
                [r.toolId, r.employeeId, r.start, r.end]
            );
        }
        console.log(`貸出中 ${rentals.size} 件を登録しました。`);

        await conn.commit();
        console.log(`\n初期パスワードは全員 "${DEFAULT_PASSWORD}" です。運用前に必ず変更してください。`);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => db.end());
