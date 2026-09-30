import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContext'
import { checkToken, clearToken, fetchMe, getToken, login } from '../api'

// この画面にはまだログイン UI が無いため、起動時に既定の社員で自動ログインする。
// 使うアカウントは .env の VITE_DEMO_EMPLOYEE_ID / VITE_DEMO_PASSWORD で切り替えられる。
// ログイン画面を作るときは、この自動ログインを外して login() を呼ぶだけでよい。
const DEMO_ID = import.meta.env.VITE_DEMO_EMPLOYEE_ID ?? 'E-12345'
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? 'password'

// 保存済みトークンが生きていればそれを使い、駄目なら既定アカウントでログインし直す
const signIn = async () => {
    if (getToken()) {
        try {
            await checkToken()
            return await fetchMe()
        } catch {
            clearToken()
        }
    }
    await login(DEMO_ID, DEMO_PASSWORD)
    return fetchMe()
}

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [nonce, setNonce] = useState(0)

    const reload = useCallback(() => setNonce((n) => n + 1), [])

    useEffect(() => {
        let ignore = false
        // effect の中で同期的に setState しないよう、状態更新は非同期側で行う
        Promise.resolve()
            .then(signIn)
            .then((me) => {
                if (ignore) return
                setUser(me)
                setError('')
                setLoading(false)
            })
            .catch((err) => {
                if (ignore) return
                setError(err.message)
                setLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [nonce])

    const value = useMemo(() => ({ user, loading, error, reload }), [user, loading, error, reload])

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center font-semibold">
                読み込み中...
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="font-semibold text-red-600">{error}</p>
                <p className="text-sm text-sub">
                    backend が起動しているか、backend/.env の設定を確認してください。
                </p>
                <button
                    type="button"
                    onClick={reload}
                    className="rounded-lg bg-main px-6 py-2 font-extrabold text-surface"
                >
                    再試行
                </button>
            </div>
        )
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
