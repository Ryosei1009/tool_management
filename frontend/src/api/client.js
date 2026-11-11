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

// 通信の状態を画面（オフラインの表示・ログイン画面への切り替え）に伝えるためのイベント
//   tm:network … detail: { online: boolean }（通信に失敗した / 成功した）
//   tm:unauthorized … ログインが無効になった（期限切れ・無効化・パスワード変更）
//   tm:password-required … パスワードの変更が必要になった
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))

export const NETWORK_ERROR_MESSAGE =
    '通信できませんでした。電波の良い場所で、もう一度操作してください。'

// バックエンドはエラーをプレーンテキストで返すので、その文言をそのまま例外にする。
// status が 0 のものは「サーバーに届かなかった」（オフライン・圏外）。
class ApiError extends Error {
    constructor(message, status, data) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        // 取り込みのエラー行など、エラーでも JSON が返るときの中身
        this.data = data
    }
}

const send = async (path, { method = 'GET', body, auth = true, isForm = false } = {}) => {
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
        emit('tm:network', { online: false })
        throw new ApiError(NETWORK_ERROR_MESSAGE, 0)
    }
    emit('tm:network', { online: true })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        let data
        try {
            data = JSON.parse(text)
        } catch {
            // 文言だけのエラー
        }
        if (res.status === 401 && auth) {
            clearToken()
            emit('tm:unauthorized')
        }
        if (res.status === 403 && /パスワードを変更/.test(text)) emit('tm:password-required')
        throw new ApiError(data ? '入力内容にエラーがあります。' : text || `通信に失敗しました（${res.status}）`, res.status, data)
    }
    // 貸出・返却・点検などで状況が変わったら、お知らせを取り直してもらう
    if (method !== 'GET' && auth) emit('tm:changed')
    return res
}

const request = async (path, options) => {
    const res = await send(path, options)
    // 204 や空ボディにも耐えるようにしておく
    const text = await res.text()
    if (!text) return null
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

// ファイル（CSV）を受け取って保存する。認証ヘッダーが要るので、リンクではなく fetch で取る。
const download = async (path, fallbackName = 'download.csv') => {
    const res = await send(path)
    const blob = await res.blob()
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return name
}

export const api = {
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    download,
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
