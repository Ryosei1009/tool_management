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
    { table: 'tools', column: 'defect_rank', definition: "ENUM('minor','repair','replace','waiting') NULL AFTER state" },
    { table: 'tools', column: 'defect_note', definition: 'TEXT NULL AFTER defect_rank' },
    { table: 'tools', column: 'purchase_date', definition: 'DATE NULL AFTER pin_y' },
    { table: 'rentals', column: 'start_period', definition: "ENUM('am','pm') NOT NULL DEFAULT 'am' AFTER start_date" },
    { table: 'rentals', column: 'end_period', definition: "ENUM('am','pm') NOT NULL DEFAULT 'pm' AFTER end_date" },
    { table: 'rentals', column: 'taken_at', definition: 'DATETIME NULL AFTER status' },
    { table: 'rentals', column: 'taken_by', definition: 'VARCHAR(32) NULL AFTER taken_at' },
    { table: 'rentals', column: 'returned_by', definition: 'VARCHAR(32) NULL AFTER returned_at' },
];

// 列の定義を変えたもの。現在の定義と違うときだけ MODIFY する。
// before は MODIFY の前に流す SQL（なくなる値を移し替えるなど）。
const MODIFIED_COLUMNS = [
    {
        // 状態から「破損」をなくした。破損だった工具は「不良」にする。
        table: 'tools',
        column: 'state',
        type: "enum('good','bad')",
        definition: "ENUM('good','bad') NOT NULL DEFAULT 'good'",
        before: "UPDATE tools SET state = 'bad' WHERE state = 'damaged'",
    },
    {
        // 不良ランクに「交換待ち」を追加
        table: 'tools',
        column: 'defect_rank',
        type: "enum('minor','repair','replace','waiting')",
        definition: "ENUM('minor','repair','replace','waiting') NULL",
    },
    {
        table: 'rentals',
        column: 'status',
        type: "enum('reserved','renting','returned','cancelled')",
        definition: "ENUM('reserved','renting','returned','cancelled') NOT NULL DEFAULT 'renting'",
    },
];

// 列を追加したあとに既存の行を埋める（何度実行してもよい）
const BACKFILLS = [
    // 持ち出し日時が無い古い貸出は、登録日時を持ち出し日時とみなす
    `UPDATE rentals SET taken_at = created_at
      WHERE taken_at IS NULL AND status IN ('renting', 'returned')`,
];

const main = async () => {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const database = process.env.TM_MYSQL_DATABASE || process.env.MYSQL_DATABASE;

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

        await conn.query(`USE \`${database}\``);

        for (const { table, column, type, definition, before } of MODIFIED_COLUMNS) {
            const [rows] = await conn.query(
                `SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [database, table, column]
            );
            if (rows.length === 0 || rows[0].type === type) continue;
            if (before) await conn.query(before);
            await conn.query(`ALTER TABLE \`${database}\`.\`${table}\` MODIFY COLUMN \`${column}\` ${definition}`);
            console.log(`列の定義を変更しました: ${table}.${column}`);
        }

        for (const sql of BACKFILLS) await conn.query(sql);
    } finally {
        await conn.end();
    }
};

main().catch((err) => {
    console.error('スキーマの作成に失敗しました:', err.message);
    process.exitCode = 1;
});
