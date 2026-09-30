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

// 工具写真のアップロード。戻り値の photoUrl を createTool / updateTool に渡す。
export const uploadToolImage = (file) => {
    const form = new FormData()
    form.append('image', file)
    return api.post('/tools/upload', form, { isForm: true })
}

/* ---------------- 貸出 ---------------- */

export const fetchMyRentals = () => api.get('/rentals/mine')

export const fetchRentals = () => api.get('/rentals/get')

export const createRental = ({ toolId, startDate, endDate, reserved, pin }) =>
    api.post('/rentals/create', { toolId, startDate, endDate, reserved, pin })

export const returnRental = ({ rentalId, state }) => api.post('/rentals/return', { rentalId, state })

export const renewRental = ({ rentalId, startDate, endDate, state, pin }) =>
    api.post('/rentals/renew', { rentalId, startDate, endDate, state, pin })

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

// 工具を借りるときの既定の置き場所。null を渡すと解除。
export const updateDefaultPin = (defaultPin) => api.post('/employees/update', { defaultPin })
