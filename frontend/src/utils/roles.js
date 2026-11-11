// 権限。値は backend の employees.permission（ENUM）と一致させる。
//   管理者 … すべての操作
//   班長   … 自分の班のメンバーの貸出状況の確認、パスワードの初期化、ロックの解除
//   一般   … 自分（と同じ班のメンバーの代理）の貸し借り
export const ADMIN = '管理者'
export const LEADER = '班長'
export const MEMBER = '一般'
export const ROLES = [MEMBER, LEADER, ADMIN]

export const isAdmin = (user) => user?.permission === ADMIN
export const isLeader = (user) => user?.permission === LEADER
// 管理ダッシュボードを開ける人
export const canSeeDashboard = (user) => isAdmin(user) || isLeader(user)

// パスワードのルール（backend の utils/password.js と同じ）。問題があればその理由、なければ ''。
export const PASSWORD_RULE = '8文字以上で、英字と数字の両方を含めてください。'

export const checkPassword = (password, employeeId) => {
    if (!password) return ''
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return `パスワードは${PASSWORD_RULE}`
    }
    if (employeeId && password.toLowerCase() === String(employeeId).toLowerCase()) {
        return '社員IDと同じパスワードは使えません。'
    }
    return ''
}
