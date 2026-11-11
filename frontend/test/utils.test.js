// 画面側の計算（区画の判定・パスワードの確認・返却期限の表示）のテスト。
//   実行: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { buildGrid, findRegion, getMapImage, getMapName, setMapConfig } from '../src/utils/map.js'
import { checkPassword, canSeeDashboard, isAdmin } from '../src/utils/roles.js'
import { getDueInfo, nextSlot, overlaps, slotKey } from '../src/utils/period.js'

test('マップ：初期の区画は A1〜A9', () => {
    assert.equal(getMapName(19, 17), 'A1')
    assert.equal(getMapName(80, 80), 'A9')
    assert.equal(getMapName(100, 100), 'A9')
    assert.equal(getMapName(undefined, 10), undefined)
    assert.equal(getMapImage(), '/img/map.png')
})

test('マップ：設定を読み込むと、区画名と画像が変わる', () => {
    const regions = buildGrid(2, 2, ['北西', '北東'])
    assert.deepEqual(regions.map((r) => r.name), ['北西', '北東', 'B1', 'B2'])
    assert.equal(findRegion(regions, 50, 50), 'B2')
    assert.equal(findRegion(regions, 49.9, 49.9), '北西')

    setMapConfig({ imageUrl: '/images/map.png', rows: 2, cols: 2, regions })
    assert.equal(getMapName(80, 80), 'B2')
    assert.equal(getMapImage(), '/images/map.png')

    // 壊れた設定は無視して、今の設定を使い続ける
    setMapConfig(null)
    setMapConfig({ regions: [] })
    assert.equal(getMapName(10, 10), '北西')
})

test('パスワードの確認', () => {
    assert.equal(checkPassword('', 'E-1'), '')
    assert.equal(checkPassword('Abcdefg1', 'E-1'), '')
    assert.ok(checkPassword('abc1', 'E-1'))
    assert.ok(checkPassword('abcdefgh', 'E-1'))
    assert.ok(checkPassword('12345678', 'E-1'))
    assert.ok(checkPassword('employee1', 'EMPLOYEE1'))
})

test('権限', () => {
    assert.equal(isAdmin({ permission: '管理者' }), true)
    assert.equal(isAdmin({ permission: '班長' }), false)
    assert.equal(canSeeDashboard({ permission: '班長' }), true)
    assert.equal(canSeeDashboard({ permission: '一般' }), false)
    assert.equal(canSeeDashboard(null), false)
})

test('期間', () => {
    assert.deepEqual(nextSlot('2026-10-31', 'pm'), { date: '2026-11-01', period: 'am' })
    const range = (s, sp, e, ep) => ({ start: slotKey(s, sp), end: slotKey(e, ep) })
    assert.equal(overlaps(range('2026-10-07', 'am', '2026-10-07', 'am'), range('2026-10-07', 'pm', '2026-10-08', 'am')), false)
    assert.equal(overlaps(range('2026-10-07', 'am', '2026-10-08', 'am'), range('2026-10-08', 'am', '2026-10-09', 'am')), true)
})

test('返却期限の表示', () => {
    const now = new Date(2026, 9, 7, 13, 0)
    assert.equal(getDueInfo('2026-10-05', 'pm', now).urgent, true)
    assert.match(getDueInfo('2026-10-05', 'pm', now).label, /2 日過ぎています/)
    assert.match(getDueInfo('2026-10-07', 'am', now).label, /今日の午前）を過ぎています/)
    assert.match(getDueInfo('2026-10-07', 'pm', now).label, /今日の午後が返却期限/)
    assert.equal(getDueInfo('2026-10-09', 'pm', now).urgent, false)
    assert.equal(getDueInfo('2026-10-20', 'pm', now), null)
})
