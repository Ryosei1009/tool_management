import { useState } from 'react'
import Modal from '../Util/Modal'
import Button from '../Util/Button'
import { resetEmployeePassword } from '../../api'
import { PASSWORD_RULE, checkPassword } from '../../utils/roles'

// 他の社員のパスワードを初期化する（管理者・同じ班の班長）。
// ここで決めた初期パスワードを本人に伝える。本人は次のログインで自分のパスワードに変更する。
const Form = ({ employee, onClose, onDone }) => {
    const [password, setPassword] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const problem = checkPassword(password, employee.id)

    const handleSave = async () => {
        setSaving(true)
        setError('')
        try {
            await resetEmployeePassword({ id: employee.id, password })
            onDone?.(employee)
        } catch (err) {
            setError(err.message)
            setSaving(false)
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <p className="text-lg font-bold">
                {employee.name}（{employee.id}）のパスワードを初期化します。
                今のパスワードは使えなくなり、ログインのロックも解除されます。
            </p>

            <div className="flex flex-col gap-2">
                <label htmlFor="reset-password" className="text-lg font-bold">
                    新しい初期パスワード
                </label>
                <input
                    id="reset-password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    className="w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold"
                />
                <p className="text-base text-sub">
                    {PASSWORD_RULE} 本人に伝え、次のログインで変更してもらいます。
                </p>
            </div>

            {(problem || error) && (
                <p role="alert" className="text-lg font-bold text-accent">
                    ✕ {error || problem}
                </p>
            )}

            <div className="flex gap-4">
                <Button variant="secondary" className="w-1/2" onClick={onClose}>
                    やめる
                </Button>
                <Button className="w-1/2" onClick={handleSave} disabled={!password || Boolean(problem) || saving}>
                    {saving ? '初期化中...' : '初期化する'}
                </Button>
            </div>
        </div>
    )
}

const ResetPasswordModal = ({ employee, onClose, onDone }) => (
    <Modal
        isOpen={employee !== null}
        setIsOpen={(open) => !open && onClose()}
        title="パスワードの初期化"
        maxWidth="max-w-2xl"
    >
        {/* 開くたびに入力を空にするため、対象ごとに作り直す */}
        {employee && <Form key={employee.id} employee={employee} onClose={onClose} onDone={onDone} />}
    </Modal>
)

export default ResetPasswordModal
