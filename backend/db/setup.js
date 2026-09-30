// db/schema.sql を .env の接続情報で流し込む。
// mysql コマンドが無くても `npm run setup` だけで初期化できるようにするためのもの。
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mysql = require('mysql2/promise');

// schema.sql は CREATE TABLE IF NOT EXISTS なので、既存の DB には後から
// 増やした列が入らない。ここで不足分だけ追加する（何度実行してもよい）。
const ADDED_COLUMNS = [
    { table: 'employees', column: 'default_pin_x', definition: 'DECIMAL(6,3) NULL AFTER password_hash' },
    { table: 'employees', column: 'default_pin_y', definition: 'DECIMAL(6,3) NULL AFTER default_pin_x' },
];

const main = async () => {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const database = process.env.MYSQL_DATABASE;

    // schema.sql 側に CREATE DATABASE / USE があるので database は指定せずに接続する
    const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        multipleStatements: true,
    });

    try {
        await conn.query(sql);
        console.log(`スキーマを作成しました（database: ${database}）。`);

        for (const { table, column, definition } of ADDED_COLUMNS) {
            const [rows] = await conn.query(
                `SELECT 1 FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [database, table, column]
            );
            if (rows.length > 0) continue;
            await conn.query(`ALTER TABLE \`${database}\`.\`${table}\` ADD COLUMN \`${column}\` ${definition}`);
            console.log(`列を追加しました: ${table}.${column}`);
        }
    } finally {
        await conn.end();
    }
};

main().catch((err) => {
    console.error('スキーマの作成に失敗しました:', err.message);
    process.exitCode = 1;
});
