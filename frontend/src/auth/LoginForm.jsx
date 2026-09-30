import React, { useState } from 'react'
import Button from '../components/Util/Button'

// 社員ID + パスワードのログイン画面。
// 手袋でも押しやすいよう入力欄とボタンは大きく取り、エラーは文言で示す。
const LoginForm = ({ onLogin }) => {
    const [id, setId] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!id.trim() || !password) {
            setError('社員IDとパスワードを入力してください。')
            return
        }
        setSubmitting(true)
        setError('')
        try {
            await onLogin(id.trim(), password)
        } catch (err) {
            setError(err.message)
            setSubmitting(false)
        }
    }

    const inputClass =
        'w-full rounded-xl border-2 border-ink bg-surface px-4 min-h-touch text-xl font-bold outline-none focus:border-accent'

    return (
        <div className="flex min-h-screen items-center justify-center px-5 py-10">
            <form onSubmit={handleSubmit} className="w-full max-w-md" noValidate>
                <div className="mb-8 border-b-4 border-line pb-3">
                    <div className="flex items-center gap-3">
                        <span className="h-9 w-2 shrink-0 rounded bg-accent" aria-hidden="true" />
                        <h1 className="text-3xl font-extrabold text-ink">ログイン</h1>
                    </div>
                    <p className="pt-2 pl-5 text-base text-sub">工具管理アプリ</p>
                </div>

                <label htmlFor="login-id" className="mb-2 block text-lg font-bold text-ink">
                    社員ID
                </label>
                <input
                    id="login-id"
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="characters"
                    placeholder="例）E-12345"
                    className={`${inputClass} mb-6`}
                />

                <label htmlFor="login-password" className="mb-2 block text-lg font-bold text-ink">
                    パスワード
                </label>
                <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={`${inputClass} mb-6`}
                />

                {error && (
                    <p role="alert" className="mb-6 font-semibold text-red-600">
                        {error}
                    </p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'ログイン中...' : 'ログイン'}
                </Button>
            </form>
        </div>
    )
}

export default LoginForm
