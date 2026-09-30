import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContext'
import LoginForm from './LoginForm'
import { checkToken, clearToken, fetchMe, getToken, login } from '../api'

// 保存済みトークンが生きていればそのユーザーを返す。無い・切れていれば null（ログイン画面へ）。
// サーバーに繋がらないときはトークンを消さずに例外を投げ、再試行できるようにする。
const restoreSession = async () => {
    if (!getToken()) return null
    try {
        await checkToken()
        return await fetchMe()
    } catch (err) {
        if (err.status === 0) throw err
        clearToken()
        return null
    }
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
            .then(restoreSession)
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

    const signIn = useCallback(async (id, password) => {
        await login(id, password)
        setUser(await fetchMe())
    }, [])

    const signOut = useCallback(() => {
        clearToken()
        setUser(null)
    }, [])

    const value = useMemo(
        () => ({ user, loading, error, reload, signOut }),
        [user, loading, error, reload, signOut]
    )

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
                    通信環境を確認して、もう一度お試しください。
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

    if (!user) return <LoginForm onLogin={signIn} />

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
