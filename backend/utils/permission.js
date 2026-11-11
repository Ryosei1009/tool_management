// 代理での貸し借りの判定。
// 本人・管理者に加え、同じ班（team が同じで空でない）のメンバーなら代わりに操作できる。
// actor は authenticate が毎回 DB から取り直した社員（id / team / permission）。
const canActFor = async (conn, actor, employeeId) => {
    if (!employeeId || actor.id === employeeId) return true;
    if (actor.permission === '管理者') return true;
    if (!actor.team) return false;

    const [rows] = await conn.query('SELECT team FROM employees WHERE id = ?', [employeeId]);
    return Boolean(rows[0]?.team) && rows[0].team === actor.team;
};

module.exports = { canActFor };
