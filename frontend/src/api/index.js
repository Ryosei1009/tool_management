// 画面から呼ぶ API 関数群。パスは backend/README.md の一覧に対応する。
import { api, API_BASE_URL, setToken, clearToken, getToken } from './client'

export { API_BASE_URL, setToken, clearToken, getToken }
export { resolveImageUrl, publicUrl, ApiError, NETWORK_ERROR_MESSAGE } from './client'

/* ---------------- 認証 ---------------- */

// 戻り値の mustChangePassword が true のときは、先にパスワードを変更してもらう
export const login = async (id, password) => {
    const data = await api.post('/auth/login', { id, password }, { auth: false })
    setToken(data.token)
    return data
}

export const checkToken = () => api.post('/auth/check')

/* ---------------- 工具 ---------------- */

// includeInactive … 無効化した工具も含める（管理者のみ有効）
export const fetchTools = ({ includeInactive = false } = {}) =>
    api.get(`/tools/get${includeInactive ? '?includeInactive=1' : ''}`)

export const fetchTool = (id) => api.get(`/tools/get/${encodeURIComponent(id)}`)

export const createTool = (tool) => api.post('/tools/create', tool)

export const updateTool = (tool) => api.post('/tools/update', tool)

// 無効化（一覧から外す。履歴は残る）と、元に戻す
export const deactivateTool = (id) => api.post('/tools/delete', { id })

export const restoreTool = (id) => api.post('/tools/restore', { id })

// 点検の記録。results は [{ itemId, ok }]。NG のときは state / defectRank / defectNote も渡せる。
export const inspectTool = (inspection) => api.post('/tools/inspect', inspection)

// 工具写真・マップ画像のアップロード。戻り値の photoUrl を保存時に渡す。
export const uploadToolImage = (file) => {
    const form = new FormData()
    form.append('image', file)
    return api.post('/tools/upload', form, { isForm: true })
}

/* ---------------- 貸出 ---------------- */

// scope='team' で同じ班のメンバーの分（代理で返却・延長するため）
export const fetchMyRentals = (scope) => api.get(`/rentals/mine${scope === 'team' ? '?scope=team' : ''}`)

// mode='rent' は今すぐ借りる、'reserve' は予約。employeeId を渡すと同じ班の人の代理で借りる。
export const createRental = (rental) => api.post('/rentals/create', rental)

// 予約していた工具を持ち出す
// ロープは loadChecked: true（荷重に問題がないことを確認した）が必要
export const startRental = ({ rentalId, endDate, endPeriod, pin, loadChecked }) =>
    api.post('/rentals/start', { rentalId, endDate, endPeriod, pin, loadChecked })

export const cancelReservation = (rentalId) => api.post('/rentals/cancel', { rentalId })

export const returnRental = ({ rentalId, state, defectRank, defectNote }) =>
    api.post('/rentals/return', { rentalId, state, defectRank, defectNote })

export const renewRental = (rental) => api.post('/rentals/renew', rental)

export const transferRental = ({ rentalId, toEmployeeId }) =>
    api.post('/rentals/transfer', { rentalId, toEmployeeId })

/* ---------------- 社員 ---------------- */

// includeInactive … 無効化した社員も含める（管理者のみ有効）
export const fetchEmployees = ({ includeInactive = false } = {}) =>
    api.get(`/employees/get${includeInactive ? '?includeInactive=1' : ''}`)

export const fetchMe = () => api.get('/employees/me')

export const createEmployee = (employee) => api.post('/employees/create', employee)

export const updateEmployee = (employee) => api.post('/employees/update', employee)

// 無効化（ログインできなくする。履歴は残る）と、元に戻す
export const deactivateEmployee = (id) => api.post('/employees/delete', { id })

export const restoreEmployee = (id) => api.post('/employees/restore', { id })

// 自分のパスワードを変える。現在のパスワードが必要。新しいトークンに入れ替える。
export const changeMyPassword = async ({ currentPassword, password }) => {
    const data = await api.post('/employees/password', { currentPassword, password })
    if (data?.token) setToken(data.token)
    return data
}

// 他の社員のパスワードを初期化する（管理者・同じ班の班長）。本人は次のログインで変更する。
export const resetEmployeePassword = ({ id, password }) => api.post('/employees/password', { id, password })

// ログインのロックを解除する（管理者・同じ班の班長）
export const unlockEmployee = (id) => api.post('/employees/unlock', { id })

// 工具を借りるときの既定の持ち出し場所。null を渡すと解除。
export const updateDefaultPin = (defaultPin) => api.post('/employees/update', { defaultPin })

/* ---------------- 点検項目 ---------------- */

export const fetchInspectionItems = () => api.get('/inspection-items/get')

// categories を渡すと、その大項目の工具すべてに割り当てる
export const createInspectionItem = ({ name, categories }) =>
    api.post('/inspection-items/create', { name, categories })

export const updateInspectionItem = ({ id, name }) => api.post('/inspection-items/update', { id, name })

export const reorderInspectionItems = (ids) => api.post('/inspection-items/reorder', { ids })

export const deleteInspectionItem = (id) => api.post('/inspection-items/delete', { id })

/* ---------------- お知らせ・ダッシュボード ---------------- */

// 画面上部に出すお知らせ（返却遅れ・点検期限など）。[{ id, level, text, to }]
export const fetchNotifications = () => api.get('/notifications')

// 管理者・班長向けの一覧（返却遅れ・不良・点検期限・ロック中の社員）
export const fetchDashboard = () => api.get('/dashboard')

/* ---------------- マップの設定 ---------------- */

export const fetchMapConfig = () => api.get('/settings/map')

// { imageUrl, rows, cols, names } / { reset: true }
export const saveMapConfig = (config) => api.post('/settings/map', config)

/* ---------------- CSV（管理者のみ） ---------------- */

const period = ({ from, to } = {}) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const query = params.toString()
    return query ? `?${query}` : ''
}

export const downloadToolsCsv = () => api.download('/csv/tools/export', 'tools.csv')

export const downloadEmployeesCsv = () => api.download('/csv/employees/export', 'employees.csv')

export const downloadRentalsCsv = (range) => api.download(`/csv/rentals/export${period(range)}`, 'rentals.csv')

export const downloadInspectionsCsv = (range) =>
    api.download(`/csv/inspections/export${period(range)}`, 'inspections.csv')

// 取り込み。kind は 'tools' / 'employees'。dryRun=true なら内容の確認だけ（登録しない）。
// エラー行があるときは ApiError（data に行ごとの結果）が投げられる。
export const importCsv = (kind, file, { dryRun = false } = {}) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/csv/${kind}/import${dryRun ? '?dryRun=1' : ''}`, form, { isForm: true })
}
