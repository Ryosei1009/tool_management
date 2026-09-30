// バックエンド（backend/）との通信をまとめる薄いラッパー。
// 接続先は .env の VITE_API_BASE_URL で切り替える。
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000').replace(
    /\/$/,
    ''
)

const TOKEN_KEY = 'tool_management_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// バックエンドはエラーをプレーンテキストで返すので、その文言をそのまま例外にする
class ApiError extends Error {
    constructor(message, status) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }
}

const request = async (path, { method = 'GET', body, auth = true, isForm = false } = {}) => {
    const headers = {}
    if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth) {
        const token = getToken()
        if (token) headers.Authorization = token
    }

    let res
    try {
        res = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
        })
    } catch {
        throw new ApiError('サーバーに接続できません。backend が起動しているか確認してください。', 0)
    }

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        if (res.status === 401) clearToken()
        throw new ApiError(text || `通信に失敗しました（${res.status}）`, res.status)
    }

    // 204 や空ボディにも耐えるようにしておく
    const text = await res.text()
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

export const api = {
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
}

// frontend/public 配下のファイルの URL。
// 本番は /tool/ 配下で配信する（vite の base）ので、先頭に BASE_URL を付ける。
export const publicUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

// 工具写真の URL を解決する。
// シードデータは frontend/public 配下の "/img/..."、アップロード画像は
// backend が配信する "/images/..." なので後者は API のオリジンを足す。
export const resolveImageUrl = (photoUrl) => {
    if (!photoUrl) return ''
    if (/^https?:\/\//.test(photoUrl)) return photoUrl
    if (photoUrl.startsWith('/images/')) return `${API_BASE_URL}${photoUrl}`
    if (photoUrl.startsWith('/img/')) return publicUrl(photoUrl)
    return photoUrl
}

export { ApiError }
