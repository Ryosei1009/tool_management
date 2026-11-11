// API テストの共通処理。
// テスト用のデータベース（既定は tool_management_test）に対して実際に API を呼ぶ。
//   準備: TM_MYSQL_DATABASE=tool_management_test node db/setup.js
// 接続先（ホスト・ユーザー・パスワード）は .env のものを使う。
process.env.TM_MYSQL_DATABASE = process.env.TM_TEST_DATABASE || 'tool_management_test';
process.env.TM_JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.TM_ACCESS_LOG = 'off';
require('dotenv').config({ quiet: true });

const express = require('express');
const bcrypt = require('bcryptjs');

const pool = require('../db/pool');
const db = pool.promise;

// テストで使うパスワード（ルールを満たすもの）
const PASSWORD = 'Passw0rd-test';

let server;
let baseUrl;

const start = async () => {
    const app = express();
    app.use(require('../router').api);
    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
};

const stop = async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.end();
};

// 全テーブルを空にして、社員を入れ直す
const reset = async () => {
    if (!/test/i.test(process.env.TM_MYSQL_DATABASE)) {
        throw new Error('テスト用ではないデータベースを消そうとしています。');
    }
    for (const table of [
        'tool_change_logs',
        'inspection_results',
        'inspections',
        'tool_inspection_items',
        'inspection_items',
        'rentals',
        'tools',
        'employees',
        'app_settings',
    ]) {
        await db.query(`DELETE FROM ${table}`);
    }
    const { loadMapConfig } = require('../utils/map');
    await loadMapConfig(db, { force: true });

    const hash = await bcrypt.hash(PASSWORD, 4);
    const employees = [
        ['E-ADMIN', '管理 太郎', '管理', '管理者'],
        ['E-LEAD', '班長 花子', '第1班', '班長'],
        ['E-M1', '一班 一郎', '第1班', '一般'],
        ['E-M2', '二班 二郎', '第2班', '一般'],
    ];
    for (const [id, name, team, permission] of employees) {
        await db.query(
            'INSERT INTO employees (id, name, team, permission, password_hash) VALUES (?, ?, ?, ?, ?)',
            [id, name, team, permission, hash]
        );
    }
};

const addTool = (id, fields = {}) => {
    const values = { id, name: `工具${id}`, category: '切断工具', pin_x: 10, pin_y: 10, ...fields };
    const columns = Object.keys(values);
    return db.query(`INSERT INTO tools (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, [
        ...columns.map((c) => values[c]),
    ]);
};

// { status, body }。body は JSON なら解析したもの、そうでなければ文字列。
const call = async (method, path, { token, body, form } = {}) => {
    const headers = {};
    if (token) headers.Authorization = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = buffer.toString('utf8');
    let parsed = text;
    try {
        parsed = JSON.parse(text);
    } catch {
        // 文字列のまま返す
    }
    return { status: res.status, body: parsed, text, buffer, headers: res.headers };
};

const get = (path, token) => call('GET', path, { token });
const post = (path, body, token) => call('POST', path, { token, body });

const login = async (id, password = PASSWORD) => {
    const res = await post('/auth/login', { id, password });
    if (res.status !== 200) throw new Error(`ログインできません: ${id} ${res.status} ${res.text}`);
    return res.body.token;
};

// CSV などのファイルを送る
const upload = (path, token, { field = 'file', filename = 'data.csv', content, type = 'text/csv' }) => {
    const form = new FormData();
    form.append(field, new Blob([content], { type }), filename);
    return call('POST', path, { token, form });
};

module.exports = { db, PASSWORD, start, stop, reset, addTool, call, get, post, login, upload };
