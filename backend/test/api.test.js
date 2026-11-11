const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, PASSWORD, start, stop, reset, addTool, get, post, login, upload } = require('./helpers');
const { nowJst, todayJst } = require('../utils/time');
const { addMonths } = require('../utils/inspection');

before(start);
after(stop);
beforeEach(reset);

// 今日から days 日ずらした日付
const dayOffset = (days) => {
    const d = new Date(`${todayJst()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

/* ---------------- 認証 ---------------- */

test('ログインしていないと、工具一覧も詳細も見られない', async () => {
    await addTool('A1');
    assert.equal((await get('/tools/get')).status, 401);
    assert.equal((await get('/tools/get/A1')).status, 401);
    assert.equal((await get('/employees/get')).status, 401);
    assert.equal((await get('/csv/tools/export')).status, 401);
    assert.equal((await get('/health')).status, 200);
});

test('5回間違えるとロックされ、正しいパスワードでも入れない。管理者が解除できる', async () => {
    for (let i = 0; i < 4; i += 1) {
        assert.equal((await post('/auth/login', { id: 'E-M1', password: 'wrong' })).status, 401);
    }
    assert.equal((await post('/auth/login', { id: 'E-M1', password: 'wrong' })).status, 423);
    assert.equal((await post('/auth/login', { id: 'E-M1', password: PASSWORD })).status, 423);

    // 違う班の一般社員・班長は解除できない
    assert.equal((await post('/employees/unlock', { id: 'E-M1' }, await login('E-M2'))).status, 403);

    const admin = await login('E-ADMIN');
    const list = await get('/employees/get', admin);
    assert.equal(list.body.find((e) => e.id === 'E-M1').locked, true);
    assert.equal((await post('/employees/unlock', { id: 'E-M1' }, admin)).status, 200);
    assert.equal((await post('/auth/login', { id: 'E-M1', password: PASSWORD })).status, 200);
});

test('ロックの時間が過ぎれば自動で入れる', async () => {
    await db.query("UPDATE employees SET locked_until = '2000-01-01 00:00:00' WHERE id = 'E-M1'");
    assert.equal((await post('/auth/login', { id: 'E-M1', password: PASSWORD })).status, 200);
});

test('存在しない社員IDと、パスワード間違いは同じ文言で返す', async () => {
    const unknown = await post('/auth/login', { id: 'E-NONE', password: 'x' });
    assert.equal(unknown.status, 401);
    assert.match(unknown.text, /社員IDまたはパスワードが違います/);
});

test('初期パスワードのままでは他の操作ができず、変更すると使える', async () => {
    const admin = await login('E-ADMIN');
    const created = await post(
        '/employees/create',
        { id: 'E-NEW', name: '新人', team: '第1班', password: 'Initial123' },
        admin
    );
    assert.equal(created.status, 201);

    const res = await post('/auth/login', { id: 'E-NEW', password: 'Initial123' });
    assert.equal(res.body.mustChangePassword, true);
    const token = res.body.token;

    assert.equal((await get('/tools/get', token)).status, 403);
    assert.equal((await get('/employees/me', token)).status, 200);

    // 現在のパスワードが必要・ルールを満たさないものは不可
    assert.equal((await post('/employees/password', { password: 'NewPass123' }, token)).status, 400);
    assert.equal(
        (await post('/employees/password', { currentPassword: 'Initial123', password: 'short1' }, token)).status,
        400
    );
    assert.equal(
        (await post('/employees/password', { currentPassword: 'Initial123', password: 'onlyletters' }, token)).status,
        400
    );
    const changed = await post('/employees/password', { currentPassword: 'Initial123', password: 'NewPass123' }, token);
    assert.equal(changed.status, 200);

    // 古いトークンは使えなくなり、返ってきた新しいトークンで続けられる
    assert.equal((await get('/tools/get', token)).status, 401);
    assert.equal((await get('/tools/get', changed.body.token)).status, 200);
});

test('ルールを満たさない古いパスワードでログインすると、変更を求められる', async () => {
    const bcrypt = require('bcryptjs');
    await db.query('UPDATE employees SET password_hash = ? WHERE id = ?', [await bcrypt.hash('password', 4), 'E-M1']);
    const res = await post('/auth/login', { id: 'E-M1', password: 'password' });
    assert.equal(res.status, 200);
    assert.equal(res.body.mustChangePassword, true);
    assert.equal((await get('/tools/get', res.body.token)).status, 403);
});

test('権限を外すと、発行済みのトークンでもすぐに管理者の操作ができなくなる', async () => {
    const admin = await login('E-ADMIN');
    const lead = await login('E-LEAD');
    assert.equal((await post('/employees/update', { id: 'E-LEAD', permission: '管理者' }, admin)).status, 200);
    assert.equal((await get('/csv/tools/export', lead)).status, 200);
    assert.equal((await post('/employees/update', { id: 'E-LEAD', permission: '一般' }, admin)).status, 200);
    assert.equal((await get('/csv/tools/export', lead)).status, 403);
});

/* ---------------- 権限 ---------------- */

test('一般社員は自分の班・権限を変えられない', async () => {
    const m1 = await login('E-M1');
    assert.equal((await post('/employees/update', { team: '第2班' }, m1)).status, 403);
    assert.equal((await post('/employees/update', { permission: '管理者' }, m1)).status, 403);
    assert.equal((await post('/employees/update', { defaultPin: { x: 10, y: 10 } }, m1)).status, 200);
});

test('班長は自分の班のメンバーのパスワードだけ初期化できる', async () => {
    const lead = await login('E-LEAD');
    assert.equal((await post('/employees/password', { id: 'E-M2', password: 'Reset1234' }, lead)).status, 403);
    assert.equal((await post('/employees/password', { id: 'E-ADMIN', password: 'Reset1234' }, lead)).status, 403);
    assert.equal((await post('/employees/password', { id: 'E-M1', password: 'Reset1234' }, lead)).status, 200);

    const res = await post('/auth/login', { id: 'E-M1', password: 'Reset1234' });
    assert.equal(res.body.mustChangePassword, true);

    // 班長は工具・社員の追加や無効化はできない
    assert.equal((await post('/tools/create', { id: 'X1', name: 'x' }, lead)).status, 403);
    assert.equal((await post('/employees/delete', { id: 'E-M1' }, lead)).status, 403);
});

test('ダッシュボードは、班長には自分の班の分だけ、一般社員には見せない', async () => {
    await addTool('A1');
    await addTool('A2');
    const m1 = await login('E-M1');
    const m2 = await login('E-M2');
    const end = dayOffset(3);
    await post('/rentals/create', { toolId: 'A1', endDate: end, endPeriod: 'pm' }, m1);
    await post('/rentals/create', { toolId: 'A2', endDate: end, endPeriod: 'pm' }, m2);

    assert.equal((await get('/dashboard', m1)).status, 403);

    const lead = await get('/dashboard', await login('E-LEAD'));
    assert.equal(lead.body.scope, 'team');
    assert.deepEqual(lead.body.rentals.map((r) => r.id), ['A1']);
    assert.equal(lead.body.defects, undefined);

    const admin = await get('/dashboard', await login('E-ADMIN'));
    assert.equal(admin.body.rentals.length, 2);
});

/* ---------------- 無効化（履歴を残す） ---------------- */

test('工具を無効化しても履歴は残り、一覧から消えて借りられなくなる。元に戻せる', async () => {
    await addTool('A1');
    const admin = await login('E-ADMIN');
    const m1 = await login('E-M1');
    const rented = await post('/rentals/create', { toolId: 'A1', endDate: dayOffset(1), endPeriod: 'pm' }, m1);
    assert.equal(rented.status, 201);

    // 貸出中は無効化できない
    assert.equal((await post('/tools/delete', { id: 'A1' }, admin)).status, 409);
    await post('/rentals/return', { rentalId: rented.body.rentalId }, m1);

    // 予約は取り消される
    const reserved = await post(
        '/rentals/create',
        { toolId: 'A1', mode: 'reserve', startDate: dayOffset(5), startPeriod: 'am', endDate: dayOffset(6), endPeriod: 'pm' },
        m1
    );
    assert.equal(reserved.status, 201);
    assert.equal((await post('/tools/delete', { id: 'A1' }, admin)).status, 200);

    const [rentals] = await db.query('SELECT status FROM rentals ORDER BY id');
    assert.deepEqual(rentals.map((r) => r.status), ['returned', 'cancelled']);

    assert.equal((await get('/tools/get', m1)).body.length, 0);
    assert.equal((await get('/tools/get?includeInactive=1', m1)).body.length, 0);
    assert.equal((await get('/tools/get?includeInactive=1', admin)).body.length, 1);
    assert.equal((await post('/rentals/create', { toolId: 'A1', endDate: dayOffset(1), endPeriod: 'pm' }, m1)).status, 404);

    // 詳細には履歴が残っている
    const detail = await get('/tools/get/A1', admin);
    assert.equal(detail.body.active, false);
    assert.equal(detail.body.history.length, 1);
    assert.equal(detail.body.history[0].user, '一班 一郎');

    assert.equal((await post('/tools/restore', { id: 'A1' }, admin)).status, 200);
    assert.equal((await get('/tools/get', m1)).body.length, 1);
});

test('社員を無効化するとログインできなくなるが、貸出履歴の名前は残る', async () => {
    await addTool('A1');
    const admin = await login('E-ADMIN');
    const m1 = await login('E-M1');
    const rented = await post('/rentals/create', { toolId: 'A1', endDate: dayOffset(1), endPeriod: 'pm' }, m1);

    assert.equal((await post('/employees/delete', { id: 'E-M1' }, admin)).status, 409);
    await post('/rentals/return', { rentalId: rented.body.rentalId }, m1);
    assert.equal((await post('/employees/delete', { id: 'E-M1' }, admin)).status, 200);
    assert.equal((await post('/employees/delete', { id: 'E-ADMIN' }, admin)).status, 400);

    // 発行済みのトークンも、新しいログインも使えない
    assert.equal((await get('/tools/get', m1)).status, 401);
    assert.equal((await post('/auth/login', { id: 'E-M1', password: PASSWORD })).status, 401);

    assert.equal((await get('/employees/get', admin)).body.some((e) => e.id === 'E-M1'), false);
    assert.equal((await get('/employees/get?includeInactive=1', admin)).body.find((e) => e.id === 'E-M1').active, false);
    assert.equal((await get('/tools/get/A1', admin)).body.history[0].user, '一班 一郎');

    // 無効化した社員には代理で借りさせられない
    assert.equal(
        (await post('/rentals/create', { toolId: 'A1', endDate: dayOffset(1), endPeriod: 'pm', employeeId: 'E-M1' }, admin))
            .status,
        404
    );

    assert.equal((await post('/employees/restore', { id: 'E-M1' }, admin)).status, 200);
    assert.equal((await post('/auth/login', { id: 'E-M1', password: PASSWORD })).status, 200);
});

/* ---------------- 点検の周期・お知らせ ---------------- */

test('点検の周期から次回点検日と状態が決まる', async () => {
    const today = todayJst();
    await addTool('OK1', { inspection_interval_months: 12, last_inspection_date: today });
    await addTool('SOON1', { inspection_interval_months: 1, last_inspection_date: dayOffset(-20) });
    await addTool('OVER1', { inspection_interval_months: 6, last_inspection_date: dayOffset(-400) });
    await addTool('NEVER1', { inspection_interval_months: 6 });
    await addTool('NONE1');
    await addTool('ROPE1', { category: 'ワイヤーロープ', last_inspection_date: dayOffset(-200) });

    const admin = await login('E-ADMIN');
    const tools = Object.fromEntries((await get('/tools/get', admin)).body.map((t) => [t.id, t.inspection]));
    assert.equal(tools.OK1.status, 'ok');
    assert.equal(tools.OK1.nextDate, addMonths(today, 12));
    assert.equal(tools.SOON1.status, 'soon');
    assert.equal(tools.OVER1.status, 'overdue');
    assert.equal(tools.NEVER1.status, 'overdue');
    assert.equal(tools.NONE1.status, 'none');
    // ロープは周期を設定していなくても 3 か月
    assert.equal(tools.ROPE1.intervalMonths, 3);
    assert.equal(tools.ROPE1.status, 'overdue');

    const dashboard = (await get('/dashboard', admin)).body;
    assert.deepEqual(dashboard.inspectionOverdue.map((t) => t.id).sort(), ['NEVER1', 'OVER1', 'ROPE1']);
    assert.deepEqual(dashboard.inspectionSoon.map((t) => t.id), ['SOON1']);

    const notices = (await get('/notifications', admin)).body.map((n) => n.id);
    assert.ok(notices.includes('inspection-overdue'));
    assert.ok(notices.includes('inspection-soon'));

    // 周期の変更は管理者のみ。点検を記録すると期限内に戻る。
    const m1 = await login('E-M1');
    assert.equal((await post('/tools/update', { id: 'OVER1', inspectionIntervalMonths: 1 }, m1)).status, 403);
    assert.equal((await post('/tools/update', { id: 'OVER1', inspectionIntervalMonths: 0 }, admin)).status, 400);
    assert.equal((await post('/tools/update', { id: 'OVER1', inspectionIntervalMonths: 3 }, admin)).status, 200);
    const detail = (await get('/tools/get/OVER1', admin)).body;
    assert.equal(detail.inspectionIntervalMonths, 3);
    assert.equal(detail.changeLogs[0].changes[0].label, '点検の周期');
});

test('返却予定を過ぎると、本人・班長・管理者にお知らせが出る', async () => {
    await addTool('A1');
    await db.query(
        `INSERT INTO rentals (tool_id, employee_id, start_date, start_period, end_date, end_period, status, taken_at, taken_by)
         VALUES ('A1', 'E-M1', ?, 'am', ?, 'pm', 'renting', ?, 'E-M1')`,
        [dayOffset(-5), dayOffset(-2), nowJst()]
    );

    const mine = (await get('/notifications', await login('E-M1'))).body;
    assert.equal(mine[0].id, 'my-overdue');
    assert.equal(mine[0].level, 'danger');

    const ids = async (id) => (await get('/notifications', await login(id))).body.map((n) => n.id);
    assert.ok((await ids('E-LEAD')).includes('team-overdue'));
    assert.ok((await ids('E-ADMIN')).includes('team-overdue'));
    assert.deepEqual(await ids('E-M2'), []);

    const tool = (await get('/tools/get/A1', await login('E-M2'))).body;
    assert.equal(tool.isOverdue, true);
});

/* ---------------- CSV ---------------- */

test('工具台帳を CSV で出力できる（Excel 用に BOM つき）', async () => {
    await addTool('A1', { name: '=危険な式', purchase_date: '2020-04-01', inspection_interval_months: 12 });
    const admin = await login('E-ADMIN');
    const res = await get('/csv/tools/export', admin);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.deepEqual([...res.buffer.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    assert.match(lines[0], /^工具ID,名前,大項目,購入日,状態/);
    // 式として実行されないよう ' が付く
    assert.match(lines[1], /^A1,'=危険な式,切断工具,2020-04-01,良好/);

    assert.equal((await get('/csv/tools/export', await login('E-M1'))).status, 403);
});

test('工具を CSV で一括登録・更新できる。エラーがあれば何も登録しない', async () => {
    await addTool('A1', { name: '旧名' });
    const admin = await login('E-ADMIN');

    const bad = ['工具ID,名前,大項目,購入日,状態,点検の周期（月）', 'A1,新名,切断工具,2021/4/1,良好,12', 'B 2,だめ,,2021-13-01,普通,0'].join(
        '\r\n'
    );
    const dry = await upload('/csv/tools/import?dryRun=1', admin, { content: bad });
    assert.equal(dry.status, 200);
    assert.equal(dry.body.committed, false);
    assert.deepEqual(dry.body.summary, { total: 2, create: 0, update: 1, error: 1 });
    assert.equal(dry.body.rows[1].line, 3);
    assert.equal(dry.body.rows[1].messages.length, 4);

    // エラーがある CSV は、確定しようとしても登録されない
    assert.equal((await upload('/csv/tools/import', admin, { content: bad })).status, 400);
    assert.equal((await get('/tools/get/A1', admin)).body.name, '旧名');

    const good = [
        '工具ID,名前,大項目,購入日,状態,不良ランク,不良内容,点検の周期（月）',
        'A1,新名,切断工具,2021/4/1,不良,要修理,刃こぼれ,12',
        'B2,"カンマ,入り",測定器,,,,,',
    ].join('\r\n');
    const done = await upload('/csv/tools/import', admin, { content: good });
    assert.equal(done.status, 200);
    assert.deepEqual(done.body.summary, { total: 2, create: 1, update: 1, error: 0 });

    const a1 = (await get('/tools/get/A1', admin)).body;
    assert.equal(a1.name, '新名');
    assert.equal(a1.state, 'bad');
    assert.equal(a1.defectRank, 'repair');
    assert.equal(a1.purchaseDate, '2021-04-01');
    assert.equal(a1.inspectionIntervalMonths, 12);
    assert.equal(a1.changeLogs[0].source, 'import');
    assert.equal((await get('/tools/get/B2', admin)).body.name, 'カンマ,入り');

    assert.equal((await upload('/csv/tools/import', await login('E-M1'), { content: good })).status, 403);
});

test('出力した工具台帳は、そのまま取り込める', async () => {
    await addTool('A1', { purchase_date: '2020-04-01', state: 'bad', defect_rank: 'minor', defect_note: 'メモ' });
    const admin = await login('E-ADMIN');
    const exported = await get('/csv/tools/export', admin);
    const res = await upload('/csv/tools/import', admin, { content: exported.buffer });
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.body.summary, { total: 1, create: 0, update: 1, error: 0 });
    const a1 = (await get('/tools/get/A1', admin)).body;
    assert.equal(a1.defectRank, 'minor');
    assert.equal(a1.defectNote, 'メモ');
});

test('Shift_JIS の CSV（Excel の CSV 保存）も取り込める', async () => {
    const admin = await login('E-ADMIN');
    // 「工具ID,名前」「S1,ペンチ」を Shift_JIS にしたもの
    const sjis = Buffer.from(
        '8d488bef49442c96bc914f0d0a53312c8379839383600d0a',
        'hex'
    );
    const res = await upload('/csv/tools/import', admin, { content: sjis });
    assert.equal(res.status, 200, res.text);
    assert.equal((await get('/tools/get/S1', admin)).body.name, 'ペンチ');
});

test('社員を CSV で一括登録できる。初期パスワードは初回ログインで変更させる', async () => {
    const admin = await login('E-ADMIN');
    const csv = [
        '社員ID,社員名,所属班,権限,血液型,初期パスワード',
        'E-N1,新規 一,第3班,一般,A,Welcome123',
        'E-M1,一班 改名,第1班,班長,,',
        'E-N2,新規 二,第3班,,,',
        'E-ADMIN,管理 太郎,管理,一般,,',
    ].join('\r\n');
    const dry = await upload('/csv/employees/import?dryRun=1', admin, { content: csv });
    assert.deepEqual(dry.body.summary, { total: 4, create: 1, update: 1, error: 2 });
    assert.match(dry.body.rows[2].messages[0], /初期パスワードが必要/);
    assert.match(dry.body.rows[3].messages[0], /自分自身の権限/);

    const ok = csv.split('\r\n').slice(0, 3).join('\r\n');
    assert.equal((await upload('/csv/employees/import', admin, { content: ok })).status, 200);

    const res = await post('/auth/login', { id: 'E-N1', password: 'Welcome123' });
    assert.equal(res.body.mustChangePassword, true);
    const m1 = (await get('/employees/get', admin)).body.find((e) => e.id === 'E-M1');
    assert.equal(m1.name, '一班 改名');
    assert.equal(m1.permission, '班長');
    // パスワードの列が空の行は、今のパスワードのまま
    assert.equal((await post('/auth/login', { id: 'E-M1', password: PASSWORD })).status, 200);

    // 出力にはパスワードを含めない
    const exported = await get('/csv/employees/export', admin);
    assert.doesNotMatch(exported.text, /Welcome123|\$2[aby]\$/);
});

test('貸出・点検の履歴を期間を指定して CSV で出力できる', async () => {
    await addTool('A1');
    const admin = await login('E-ADMIN');
    const m1 = await login('E-M1');
    await post('/rentals/create', { toolId: 'A1', endDate: dayOffset(1), endPeriod: 'pm' }, m1);
    const [item] = await db.query("INSERT INTO inspection_items (name, sort_order) VALUES ('外観', 1)");
    await db.query('INSERT INTO tool_inspection_items (tool_id, item_id) VALUES (?, ?)', ['A1', item.insertId]);
    await post('/tools/inspect', { toolId: 'A1', results: [{ itemId: item.insertId, ok: false }], state: 'bad' }, m1);

    const today = todayJst();
    const rentals = await get(`/csv/rentals/export?from=${today}&to=${today}`, admin);
    const rentalLines = rentals.text.trim().split('\r\n');
    assert.equal(rentalLines.length, 2);
    assert.match(rentalLines[1], /A1,工具A1,E-M1,一班 一郎,第1班,貸出中/);
    assert.equal((await get(`/csv/rentals/export?from=${dayOffset(1)}`, admin)).text.trim().split('\r\n').length, 1);
    assert.equal((await get('/csv/rentals/export?from=abc', admin)).status, 400);

    const inspections = await get(`/csv/inspections/export?from=${today}`, admin);
    assert.match(inspections.text.trim().split('\r\n')[1], /A1,工具A1,一班 一郎,NG,外観,外観:NG/);
});

/* ---------------- マップの設定 ---------------- */

test('マップの区画を変えると、同じ位置のピンが新しい区画名になる', async () => {
    await addTool('A1', { pin_x: 80, pin_y: 80 });
    const admin = await login('E-ADMIN');
    const m1 = await login('E-M1');

    assert.equal((await get('/tools/get/A1', m1)).body.place, 'A9');
    assert.equal((await get('/settings/map', m1)).body.regions.length, 9);

    assert.equal((await post('/settings/map', { rows: 2, cols: 2 }, m1)).status, 403);
    assert.equal((await post('/settings/map', { rows: 0, cols: 2 }, admin)).status, 400);
    assert.equal((await post('/settings/map', { rows: 1, cols: 2, names: ['同じ', '同じ'] }, admin)).status, 400);
    assert.equal((await post('/settings/map', { imageUrl: 'https://example.com/a.png' }, admin)).status, 400);

    const saved = await post('/settings/map', { rows: 2, cols: 2, names: ['北西', '北東', '南西', ''] }, admin);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.regions.map((r) => r.name), ['北西', '北東', '南西', 'B2']);
    assert.equal((await get('/tools/get/A1', m1)).body.place, 'B2');

    assert.equal((await post('/settings/map', { reset: true }, admin)).status, 200);
    assert.equal((await get('/tools/get/A1', m1)).body.place, 'A9');
});

/* ---------------- アップロード ---------------- */

test('写真は画像だけを受け付ける（SVG などは不可）', async () => {
    const admin = await login('E-ADMIN');
    const svg = await upload('/tools/upload', admin, {
        field: 'image',
        filename: 'x.svg',
        type: 'image/svg+xml',
        content: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    });
    assert.equal(svg.status, 400);
    const fake = await upload('/tools/upload', admin, {
        field: 'image',
        filename: 'x.html',
        type: 'image/png',
        content: '<script>alert(1)</script>',
    });
    assert.equal(fake.status, 400);
});
