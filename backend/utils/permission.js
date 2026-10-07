// 代理での貸し借りの判定。
// 本人・管理者に加え、同じ班（team が同じで空でない）のメンバーなら代わりに操作できる。
const canActFor = async (conn, actor, employeeId) => {
    if (!employeeId || actor.id === employeeId) return true;
    if (actor.permission === '管理者') return true;

    const [rows] = await conn.query('SELECT id, team FROM employees WHERE id IN (?, ?)', [
        actor.id,
        employeeId,
    ]);
    const me = rows.find((r) => r.id === actor.id);
    const target = rows.find((r) => r.id === employeeId);
    return Boolean(me?.team && target?.team && me.team === target.team);
};

module.exports = { canActFor };
