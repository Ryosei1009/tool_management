const { test } = require('node:test');
const assert = require('node:assert/strict');

const { validatePassword } = require('../utils/password');
const { parseCsv, parseTable, toCsv, toIsoDateCell } = require('../utils/csv');
const { addMonths, inspectionInfo } = require('../utils/inspection');
const { buildGrid, findRegion, DEFAULT_REGIONS } = require('../utils/map');
const { overlaps, rentalRange, slotKey, addMinutesJst } = require('../utils/time');
const { canManageAccount } = require('../utils/roles');

test('パスワードのルール', () => {
    assert.equal(validatePassword('Abcdefg1', 'E-1'), null);
    assert.ok(validatePassword('Abc1', 'E-1'));
    assert.ok(validatePassword('abcdefgh', 'E-1'));
    assert.ok(validatePassword('12345678', 'E-1'));
    assert.ok(validatePassword('employee1', 'EMPLOYEE1'));
    assert.ok(validatePassword(undefined, 'E-1'));
    assert.ok(validatePassword(`a1${'x'.repeat(80)}`, 'E-1'));
});

test('CSV の読み書き', () => {
    assert.deepEqual(parseCsv('a,b\r\n"1,2","he said ""hi"""\n\n"multi\nline",x'), [
        ['a', 'b'],
        ['1,2', 'he said "hi"'],
        ['multi\nline', 'x'],
    ]);
    const csv = toCsv(['名前', '式'], [['ペンチ', '=1+1'], ['a,b', '-5']]);
    assert.ok(csv.startsWith('﻿'));
    assert.equal(csv.slice(1), "名前,式\r\nペンチ,'=1+1\r\n\"a,b\",'-5\r\n");
    // 出力時に付けた ' は、取り込むときに外す
    assert.deepEqual(parseTable(csv).records, [
        { line: 2, 名前: 'ペンチ', 式: '=1+1' },
        { line: 3, 名前: 'a,b', 式: '-5' },
    ]);
});

test('CSV の日付', () => {
    assert.equal(toIsoDateCell('2026/4/1'), '2026-04-01');
    assert.equal(toIsoDateCell('2026-04-01'), '2026-04-01');
    assert.equal(toIsoDateCell('2026年4月1日'), '2026-04-01');
    assert.equal(toIsoDateCell(''), '');
    assert.equal(toIsoDateCell('2026/2/30'), null);
    assert.equal(toIsoDateCell('4/1'), null);
});

test('点検の期限', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonths('2025-11-15', 3), '2026-02-15');
    const row = { category: '切断工具', inspection_interval_months: 6, last_inspection_date: '2026-01-10' };
    assert.deepEqual(inspectionInfo(row, '2026-03-01'), {
        intervalMonths: 6,
        nextDate: '2026-07-10',
        daysLeft: 131,
        status: 'ok',
    });
    assert.equal(inspectionInfo(row, '2026-06-10').status, 'soon');
    assert.equal(inspectionInfo(row, '2026-07-10').status, 'soon');
    assert.equal(inspectionInfo(row, '2026-07-11').status, 'overdue');
    assert.equal(inspectionInfo({ ...row, inspection_interval_months: null }, '2026-07-11').status, 'none');
    assert.equal(inspectionInfo({ ...row, last_inspection_date: null }, '2026-07-11').status, 'overdue');
});

test('マップの区画', () => {
    // 初期の区画は従来の判定と同じ
    assert.equal(findRegion(DEFAULT_REGIONS, 19, 17), 'A1');
    assert.equal(findRegion(DEFAULT_REGIONS, 35, 70), 'A6');
    assert.equal(findRegion(DEFAULT_REGIONS, 100, 100), 'A9');
    assert.equal(findRegion(DEFAULT_REGIONS, null, 10), null);

    const grid = buildGrid(2, 3, ['い', 'ろ', 'は']);
    assert.deepEqual(grid.map((r) => r.name), ['い', 'ろ', 'は', 'B1', 'B2', 'B3']);
    assert.equal(findRegion(grid, 0, 0), 'い');
    assert.equal(findRegion(grid, 50, 49.9), 'ろ');
    assert.equal(findRegion(grid, 100, 100), 'B3');
    // 境界はどれか1つの区画にだけ入る
    for (let x = 0; x <= 100; x += 12.5) {
        for (let y = 0; y <= 100; y += 12.5) assert.ok(findRegion(grid, x, y), `${x},${y}`);
    }
});

test('期間の重なり', () => {
    const range = (s, sp, e, ep) => ({ start: slotKey(s, sp), end: slotKey(e, ep) });
    assert.equal(overlaps(range('2026-10-07', 'am', '2026-10-07', 'am'), range('2026-10-07', 'pm', '2026-10-08', 'am')), false);
    assert.equal(overlaps(range('2026-10-07', 'am', '2026-10-07', 'pm'), range('2026-10-07', 'pm', '2026-10-08', 'am')), true);
    // 返却予定を過ぎた貸出は、今まで続いているとみなす
    const late = { status: 'renting', start_date: '2026-10-01', start_period: 'am', end_date: '2026-10-02', end_period: 'pm' };
    assert.equal(rentalRange(late, { date: '2026-10-05', period: 'am' }).end, '2026-10-05:0');
});

test('日本時間の加算', () => {
    assert.equal(addMinutesJst('2026-10-07 23:50:00', 15), '2026-10-08 00:05:00');
});

test('アカウントを管理できる相手', () => {
    const admin = { id: 'a', permission: '管理者', team: 'x' };
    const lead = { id: 'l', permission: '班長', team: '1班' };
    assert.equal(canManageAccount(admin, { team: '2班', permission: '一般' }), true);
    assert.equal(canManageAccount(lead, { team: '1班', permission: '一般' }), true);
    assert.equal(canManageAccount(lead, { team: '2班', permission: '一般' }), false);
    assert.equal(canManageAccount(lead, { team: '1班', permission: '管理者' }), false);
    assert.equal(canManageAccount({ permission: '一般', team: '1班' }, { team: '1班', permission: '一般' }), false);
});
