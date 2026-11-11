import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContext'
import LoginForm from './LoginForm'
import ChangePasswordForm from './ChangePasswordForm'
import { checkToken, clearToken, fetchMapConfig, fetchMe, getToken, login } from '../api'
import { setMapConfig } from '../utils/map'

// ログイン中の社員と、マップの設定（区画名の判定に使う）をまとめて読み込む。
// マップの設定は、読めなくても初期の区画で動くので失敗しても止めない。
const loadSession = async () => {
    const [me, map] = await Promise.all([fetchMe(), fetchMapConfig().catch(() => null)])
    setMapConfig(map)
    return me
}

// 保存済みトークンが生きていればそのユーザーを返す。無い・切れていれば null（ログイン画面へ）。
// サーバーに繋がらないときはトークンを消さずに例外を投げ、再試行できるようにする。
const restoreSession = async () => {
    if (!getToken()) return null
    try {
        await checkToken()
        return await loadSession()
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
    // ログイン画面に出す一言（「ログインの有効期限が切れました」など）
    const [notice, setNotice] = useState('')

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

    // 使っている途中でログインが無効になった（期限切れ・無効化・別の端末でのパスワード変更）
    // ときはログイン画面へ、パスワードの変更が必要になったときは変更画面へ切り替える。
    useEffect(() => {
        const onUnauthorized = () => {
            setNotice('ログインが無効になりました。もう一度ログインしてください。')
            setUser(null)
        }
        const onPasswordRequired = () => reload()
        window.addEventListener('tm:unauthorized', onUnauthorized)
        window.addEventListener('tm:password-required', onPasswordRequired)
        return () => {
            window.removeEventListener('tm:unauthorized', onUnauthorized)
            window.removeEventListener('tm:password-required', onPasswordRequired)
        }
    }, [reload])

    const signIn = useCallback(async (id, password) => {
        await login(id, password)
        setNotice('')
        setUser(await loadSession())
    }, [])

    const signOut = useCallback(() => {
        clearToken()
        setNotice('')
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

    if (!user) return <LoginForm onLogin={signIn} notice={notice} />

    // 初期パスワード・管理者が初期化したパスワードのままでは、他の画面を使わせない
    if (user.mustChangePassword) {
        return <ChangePasswordForm user={user} onChanged={reload} onSignOut={signOut} />
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
