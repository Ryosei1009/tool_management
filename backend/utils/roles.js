// 権限は 管理者 / 班長 / 一般 の3段階。
//   管理者 … すべての操作
//   班長   … 自分の班のメンバーの貸出状況の確認、パスワードの初期化、ロックの解除
//   一般   … 自分（と同じ班のメンバーの代理）の貸し借り
const ADMIN = '管理者';
const LEADER = '班長';
const MEMBER = '一般';
const ROLES = [ADMIN, LEADER, MEMBER];

const isAdmin = (user) => user?.permission === ADMIN;
const isLeader = (user) => user?.permission === LEADER;

// 班長が target（employees の行）を管理できるか：同じ班で、相手が管理者でない
const leadsTeamOf = (user, target) =>
    isLeader(user) && Boolean(user.team) && user.team === target?.team && target?.permission !== ADMIN;

// パスワードの初期化・ロックの解除をしてよいか
const canManageAccount = (user, target) => isAdmin(user) || leadsTeamOf(user, target);

module.exports = { ADMIN, LEADER, MEMBER, ROLES, isAdmin, isLeader, leadsTeamOf, canManageAccount };
