// 画面から呼ぶ API 関数群。パスは backend/README.md の一覧に対応する。
import { api, API_BASE_URL, setToken, clearToken, getToken } from './client'

export { API_BASE_URL, setToken, clearToken, getToken }
export { resolveImageUrl, publicUrl, ApiError } from './client'

/* ---------------- 認証 ---------------- */

export const login = async (id, password) => {
    const data = await api.post('/auth/login', { id, password }, { auth: false })
    setToken(data.token)
    return data.employee
}

export const checkToken = () => api.post('/auth/check')

/* ---------------- 工具 ---------------- */

export const fetchTools = (keyword) =>
    api.get(`/tools/get${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`, { auth: false })

export const fetchTool = (id) => api.get(`/tools/get/${encodeURIComponent(id)}`, { auth: false })

export const createTool = (tool) => api.post('/tools/create', tool)

export const updateTool = (tool) => api.post('/tools/update', tool)

export const deleteTool = (id) => api.post('/tools/delete', { id })

// 点検の記録。results は [{ itemId, ok }]。NG のときは state / defectRank / defectNote も渡せる。
export const inspectTool = (inspection) => api.post('/tools/inspect', inspection)

// 工具写真のアップロード。戻り値の photoUrl を createTool / updateTool に渡す。
export const uploadToolImage = (file) => {
    const form = new FormData()
    form.append('image', file)
    return api.post('/tools/upload', form, { isForm: true })
}

/* ---------------- 貸出 ---------------- */

// scope='team' で同じ班のメンバーの分（代理で返却・延長するため）
export const fetchMyRentals = (scope) => api.get(`/rentals/mine${scope === 'team' ? '?scope=team' : ''}`)

export const fetchRentals = () => api.get('/rentals/get')

// mode='rent' は今すぐ借りる、'reserve' は予約。employeeId を渡すと同じ班の人の代理で借りる。
export const createRental = (rental) => api.post('/rentals/create', rental)

// 予約していた工具を持ち出す
export const startRental = ({ rentalId, endDate, endPeriod, pin }) =>
    api.post('/rentals/start', { rentalId, endDate, endPeriod, pin })

export const cancelReservation = (rentalId) => api.post('/rentals/cancel', { rentalId })

export const returnRental = ({ rentalId, state, defectRank, defectNote }) =>
    api.post('/rentals/return', { rentalId, state, defectRank, defectNote })

export const renewRental = (rental) => api.post('/rentals/renew', rental)

export const transferRental = ({ rentalId, toEmployeeId }) =>
    api.post('/rentals/transfer', { rentalId, toEmployeeId })

/* ---------------- 社員 ---------------- */

export const fetchEmployees = () => api.get('/employees/get')

export const fetchMe = () => api.get('/employees/me')

export const createEmployee = (employee) => api.post('/employees/create', employee)

export const updateEmployee = (employee) => api.post('/employees/update', employee)

export const deleteEmployee = (id) => api.post('/employees/delete', { id })

export const updateEmployeePassword = ({ id, password }) =>
    api.post('/employees/password', { id, password })

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
