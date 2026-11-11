import { useState } from 'react'
import Button from '../components/Util/Button'
import { changeMyPassword } from '../api'
import { PASSWORD_RULE, checkPassword } from '../utils/roles'

const inputClass =
    'w-full rounded-xl border-2 border-ink bg-surface px-4 min-h-touch text-xl font-bold outline-none focus:border-accent'

// 自分のパスワードを変える入力欄（現在のパスワード + 新しいパスワード2回）。
// マイページと、初回ログイン時の変更画面の両方で使う。
export const PasswordFields = ({ userId, onChanged, submitLabel = 'パスワードを変更する' }) => {
    const [current, setCurrent] = useState('')
    const [next, setNext] = useState('')
    const [confirm, setConfirm] = useState('')
    const [show, setShow] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // 入力の途中でも、何が足りないかを文字で伝える
    const problem =
        checkPassword(next, userId) ||
        (next && current && next === current ? '現在と同じパスワードは使えません。' : '') ||
        (confirm && next !== confirm ? '確認用のパスワードが一致しません。' : '')
    const canSubmit = current && next && confirm && !problem && !saving

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canSubmit) return
        setSaving(true)
        setError('')
        try {
            await changeMyPassword({ currentPassword: current, password: next })
            setCurrent('')
            setNext('')
            setConfirm('')
            onChanged?.()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const type = show ? 'text' : 'password'

    return (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <label htmlFor="pw-current" className="text-lg font-bold">
                    現在のパスワード
                </label>
                <input
                    id="pw-current"
                    type={type}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
                    className={inputClass}
                />
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="pw-next" className="text-lg font-bold">
                    新しいパスワード
                </label>
                <input
                    id="pw-next"
                    type={type}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    autoComplete="new-password"
                    aria-describedby="pw-rule"
                    className={inputClass}
                />
                <p id="pw-rule" className="text-base text-sub">
                    {PASSWORD_RULE}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <label htmlFor="pw-confirm" className="text-lg font-bold">
                    新しいパスワード（確認）
                </label>
                <input
                    id="pw-confirm"
                    type={type}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className={inputClass}
                />
            </div>

            <label className="flex min-h-touch items-center gap-4">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                <span className="text-lg font-bold">入力したパスワードを表示する</span>
            </label>

            {(problem || error) && (
                <p role="alert" className="text-lg font-bold text-accent">
                    ✕ {error || problem}
                </p>
            )}

            <Button type="submit" className="w-full" disabled={!canSubmit}>
                {saving ? '変更中...' : submitLabel}
            </Button>
        </form>
    )
}

// 初回ログイン時（初期パスワード・管理者が初期化したあと）のパスワード変更画面。
// 変更が済むまで他の画面には進めない。
const ChangePasswordForm = ({ user, onChanged, onSignOut }) => (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
            <div className="mb-8 border-b-4 border-line pb-3">
                <div className="flex items-center gap-3">
                    <span className="h-9 w-2 shrink-0 rounded bg-accent" aria-hidden="true" />
                    <h1 className="text-3xl font-extrabold text-ink">パスワードの変更</h1>
                </div>
                <p className="pt-2 pl-5 text-base text-sub">
                    {user.name} さん、最初に自分だけが知っているパスワードに変更してください。
                </p>
            </div>

            <PasswordFields userId={user.id} onChanged={onChanged} submitLabel="変更して始める" />

            <Button variant="secondary" size="md" className="mt-6 w-full" onClick={onSignOut}>
                ログアウト
            </Button>
        </div>
    </div>
)

export default ChangePasswordForm
