const express = require('express');
const router = express.Router();
const db = require('../db/pool').promise;
const { authenticate, requireLeader } = require('../middleware/auth');
const { toToolResponse } = require('../utils/format');
const { isAdmin, isLeader } = require('../utils/roles');
const { nowJst, todayJst, toFullDateTime } = require('../utils/time');

// アプリ内のお知らせ（/notifications）と、管理者・班長向けの一覧（/dashboard）。
// 返却遅れ・点検の期限は、メールなどは送らずに画面の上部に出す。

const RENTING_SELECT = `
    SELECT t.*,
           r.id         AS rental_id,
           r.status     AS rental_status,
           r.start_date, r.start_period, r.end_date, r.end_period,
           r.taken_at, r.taken_by,
           e.id         AS user_id,
           e.name       AS user_name,
           e.team       AS user_team,
           tb.name      AS taken_by_name
      FROM rentals r
      JOIN tools t      ON t.id = r.tool_id
      JOIN employees e  ON e.id = r.employee_id
      LEFT JOIN employees tb ON tb.id = r.taken_by
     WHERE r.status = 'renting'
     ORDER BY r.end_date, r.end_period, r.id
`;

const fetchRenting = async () => {
    const [rows] = await db.query(RENTING_SELECT);
    return rows.map(toToolResponse);
};

const fetchActiveTools = async () => {
    const [rows] = await db.query('SELECT * FROM tools WHERE active = 1 ORDER BY id');
    return rows.map(toToolResponse);
};

const fetchLocked = async () => {
    const [rows] = await db.query(
        `SELECT id, name, team, permission, locked_until FROM employees
          WHERE active = 1 AND locked_until IS NOT NULL AND locked_until > ?
          ORDER BY id`,
        [nowJst()]
    );
    return rows;
};

const names = (tools) =>
    tools.length === 1 ? `「${tools[0].name}」` : `「${tools[0].name}」ほか ${tools.length - 1} 件`;

// お知らせ。[{ id, level, text, to }]
//   level: danger（すぐ対応）/ warn（まもなく）  to: 押したときに開く画面
router.get('/notifications', authenticate, async (req, res) => {
    try {
        const today = todayJst();
        const renting = await fetchRenting();
        const mine = renting.filter((t) => t.userId === req.user.id);
        const notices = [];

        const myOverdue = mine.filter((t) => t.isOverdue);
        if (myOverdue.length > 0) {
            notices.push({
                id: 'my-overdue',
                level: 'danger',
                text: `返却予定を過ぎています：${names(myOverdue)}。返却するか、返却予定を変更してください。`,
                to: '/rentlist',
            });
        }
        const dueToday = mine.filter((t) => !t.isOverdue && t.rentEnd === today);
        if (dueToday.length > 0) {
            notices.push({
                id: 'my-due-today',
                level: 'warn',
                text: `今日が返却予定です：${names(dueToday)}`,
                to: '/rentlist',
            });
        }
        const myInspection = mine.filter((t) => t.inspection.status === 'overdue');
        if (myInspection.length > 0) {
            notices.push({
                id: 'my-inspection',
                level: 'danger',
                text: `借りている工具の点検期限が切れています：${names(myInspection)}。点検してから使用してください。`,
                to: '/tools',
            });
        }

        // 班長は自分の班、管理者は全体の返却遅れ（自分の分は上で出しているので除く）
        const admin = isAdmin(req.user);
        if (admin || isLeader(req.user)) {
            const others = renting.filter(
                (t) => t.isOverdue && t.userId !== req.user.id && (admin || (req.user.team && t.userTeam === req.user.team))
            );
            if (others.length > 0) {
                notices.push({
                    id: 'team-overdue',
                    level: 'danger',
                    text: `${admin ? '' : '班のメンバーに'}返却予定を過ぎている貸出が ${others.length} 件あります。`,
                    to: '/dashboard',
                });
            }
            const locked = (await fetchLocked()).filter(
                (e) => admin || (req.user.team && e.team === req.user.team && e.permission !== '管理者')
            );
            if (locked.length > 0) {
                notices.push({
                    id: 'locked',
                    level: 'warn',
                    text: `ログインがロックされている社員が ${locked.length} 名います。`,
                    to: '/dashboard',
                });
            }
        }

        if (admin) {
            const tools = await fetchActiveTools();
            const overdue = tools.filter((t) => t.inspection.status === 'overdue');
            const soon = tools.filter((t) => t.inspection.status === 'soon');
            if (overdue.length > 0) {
                notices.push({
                    id: 'inspection-overdue',
                    level: 'danger',
                    text: `点検期限が切れている工具が ${overdue.length} 件あります。`,
                    to: '/dashboard',
                });
            }
            if (soon.length > 0) {
                notices.push({
                    id: 'inspection-soon',
                    level: 'warn',
                    text: `30日以内に点検期限を迎える工具が ${soon.length} 件あります。`,
                    to: '/dashboard',
                });
            }
        }

        res.json(notices);
    } catch (err) {
        console.error(err);
        res.status(500).send('お知らせの取得に失敗しました。');
    }
});

// 管理者・班長向けの一覧。
//   管理者 … 全体の貸出、返却遅れ、不良の工具、点検期限、ロック中の社員
//   班長   … 自分の班のメンバーの貸出、返却遅れ、ロック中の社員
router.get('/dashboard', authenticate, requireLeader, async (req, res) => {
    try {
        const admin = isAdmin(req.user);
        const inScope = (team) => admin || (Boolean(req.user.team) && team === req.user.team);

        const rentals = (await fetchRenting()).filter((t) => inScope(t.userTeam));
        const locked = (await fetchLocked())
            .filter((e) => admin || (inScope(e.team) && e.permission !== '管理者'))
            .map((e) => ({ id: e.id, name: e.name, team: e.team, lockedUntil: toFullDateTime(e.locked_until) }));

        const body = {
            scope: admin ? 'all' : 'team',
            team: req.user.team ?? null,
            rentals,
            overdueRentals: rentals.filter((t) => t.isOverdue),
            lockedEmployees: locked,
        };

        if (admin) {
            const tools = await fetchActiveTools();
            const byDue = (a, b) => (a.inspection.nextDate || '0').localeCompare(b.inspection.nextDate || '0');
            body.defects = tools.filter((t) => t.state === 'bad');
            body.inspectionOverdue = tools.filter((t) => t.inspection.status === 'overdue').sort(byDue);
            body.inspectionSoon = tools.filter((t) => t.inspection.status === 'soon').sort(byDue);
        }

        res.json(body);
    } catch (err) {
        console.error(err);
        res.status(500).send('データの取得に失敗しました。');
    }
});

module.exports = router;
