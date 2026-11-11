// 最初の管理者を登録する（本番の初期設定用）。
//   使い方: npm run create-admin -- <社員ID> <名前> <初期パスワード>
//   例:     npm run create-admin -- E-0001 "山田 太郎" "Start2026abc"
// `npm run seed` はサンプルデータで全テーブルを入れ替えるので、本番では使わずこちらを使う。
// 登録した管理者は、初回ログインでパスワードの変更を求められる。
// すでに同じ社員IDがあるときは何もしない（上書きしない）。
require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('./pool').promise;
const { validatePassword } = require('../utils/password');
const { ADMIN } = require('../utils/roles');

const main = async () => {
    const [id, name, password] = process.argv.slice(2);
    if (!id || !name || !password) {
        throw new Error('使い方: npm run create-admin -- <社員ID> <名前> <初期パスワード>');
    }
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) {
        throw new Error('社員IDは半角の英数字・ハイフン・アンダーバー（32文字まで）にしてください。');
    }
    const invalid = validatePassword(password, id);
    if (invalid) throw new Error(invalid);

    const [rows] = await db.query('SELECT id FROM employees WHERE id = ?', [id]);
    if (rows.length > 0) {
        console.log(`社員ID ${id} は既に登録されています。何も変更しませんでした。`);
        return;
    }

    await db.query(
        `INSERT INTO employees (id, name, team, permission, password_hash, must_change_password)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [id, name, '管理', ADMIN, await bcrypt.hash(password, 10)]
    );
    console.log(`管理者 ${name}（${id}）を登録しました。初回ログインでパスワードを変更してください。`);
};

main()
    .catch((err) => {
        console.error(err.message);
        process.exitCode = 1;
    })
    .finally(() => db.end());
