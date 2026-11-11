import { useCallback, useState } from 'react'
import PageTitle from '../Util/PageTitle'
import SearchBar from '../Util/SearchBar'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import EmployeeModal from './EmployeeModal'
import ResetPasswordModal from './ResetPasswordModal'
import { deactivateEmployee, fetchEmployees, resolveImageUrl, restoreEmployee, unlockEmployee } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'
import { useAuth } from '../../auth/AuthContext'
import { matchesKeyword } from '../../utils/search'
import { ADMIN, LEADER, isAdmin } from '../../utils/roles'

const ROLE_STYLES = {
    [ADMIN]: 'border-accent text-accent',
    [LEADER]: 'border-steel text-steel',
}

const Tag = ({ className, children }) => (
    <span className={`rounded-full border-2 px-3 py-0.5 text-sm font-bold ${className}`}>{children}</span>
)

// 社員1件分のカード。
// 権限は色ではなく文字と枠で区別し、貸出中の件数も件数そのものを表示する。
//   canEdit   … 管理者（編集・無効化・元に戻す）
//   canManage … 管理者と、同じ班の班長（パスワードの初期化・ロックの解除）
const EmployeeCard = ({ employee, isMe, canEdit, busy, onEdit, onDeactivate, onRestore, onReset, onUnlock }) => {
    const { name, id, team, permission, photoUrl, defaultPlace, rentingCount, active, locked, canManage } = employee

    return (
        <li
            className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border-2 px-4 py-3 ${
                active ? 'border-ink bg-surface' : 'border-dashed border-sub bg-field'
            }`}
        >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-field">
                <img
                    src={resolveImageUrl(photoUrl || '/img/tmp/tmp_icon.png')}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                />
            </div>

            <div className="min-w-52 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-extrabold">{name}</span>
                    {/* 自分の行は取り違え防止のため明示する */}
                    {isMe && <Tag className="border-steel text-steel">自分</Tag>}
                    <Tag className={ROLE_STYLES[permission] ?? 'border-sub text-sub'}>{permission}</Tag>
                    {!active && <Tag className="border-sub bg-sub text-surface">無効化済み</Tag>}
                    {locked && <Tag className="border-accent bg-accent text-surface">✕ ロック中</Tag>}
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-1 pt-1 text-lg font-bold">
                    <span>
                        <span className="mr-2 text-base font-medium text-sub">社員ID</span>
                        {id}
                    </span>
                    <span>
                        <span className="mr-2 text-base font-medium text-sub">所属班</span>
                        {team || '―'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-1 text-lg font-bold">
                    <span>
                        <span className="mr-2 text-base font-medium text-sub">既定の持ち出し場所</span>
                        {defaultPlace ?? '未設定'}
                    </span>
                    <span>
                        <span className="mr-2 text-base font-medium text-sub">貸出中</span>
                        {rentingCount} 件
                    </span>
                </div>
            </div>

            {(canEdit || canManage) && (
                <div className="flex shrink-0 flex-wrap gap-3">
                    {!active ? (
                        canEdit && (
                            <Button size="md" variant="secondary" onClick={onRestore} disabled={busy}>
                                元に戻す
                            </Button>
                        )
                    ) : (
                        <>
                            {canManage && locked && (
                                <Button size="md" onClick={onUnlock} disabled={busy}>
                                    ロックを解除
                                </Button>
                            )}
                            {canManage && !isMe && (
                                <Button size="md" variant="secondary" onClick={onReset} disabled={busy}>
                                    パスワード初期化
                                </Button>
                            )}
                            {canEdit && (
                                <Button size="md" variant="secondary" onClick={onEdit} disabled={busy}>
                                    編集
                                </Button>
                            )}
                            {canEdit && (
                                <Button
                                    size="md"
                                    variant="danger"
                                    onClick={onDeactivate}
                                    disabled={busy || isMe || rentingCount > 0}
                                    // 押せない理由を色や淡さだけでなく文字でも伝える
                                    title={
                                        isMe
                                            ? '自分自身は無効化できません'
                                            : rentingCount > 0
                                              ? '貸出中の工具があるため無効化できません'
                                              : undefined
                                    }
                                >
                                    無効化
                                </Button>
                            )}
                        </>
                    )}
                </div>
            )}
        </li>
    )
}

const EmployeeList = () => {
    const { user } = useAuth()
    const admin = isAdmin(user)

    const [keyword, setKeyword] = useState('')
    // 無効化した社員も表示する（管理者のみ）
    const [showInactive, setShowInactive] = useState(false)
    const load = useCallback(() => fetchEmployees({ includeInactive: admin && showInactive }), [admin, showInactive])
    const { data: employees, loading, error, reload } = useFetch(load)

    const [editing, setEditing] = useState(null) // 編集対象（null=閉じている / 'new'=新規）
    const [resetTarget, setResetTarget] = useState(null)
    // 確認ダイアログの内容 { text, yesText, danger, action }
    const [confirm, setConfirm] = useState(null)
    const [busy, setBusy] = useState(false)
    const [actionError, setActionError] = useState('')
    const [message, setMessage] = useState('')

    const run = async (action, successMessage) => {
        setConfirm(null)
        if (busy) return
        setBusy(true)
        setActionError('')
        setMessage('')
        try {
            await action()
            setMessage(successMessage)
            reload()
        } catch (err) {
            setActionError(err.message)
        } finally {
            setBusy(false)
        }
    }

    const all = employees ?? []
    const filtered = keyword ? all.filter((e) => matchesKeyword(keyword, [e.name, e.id, e.team, e.permission])) : all
    const canManageSomeone = all.some((e) => e.canManage)

    return (
        <>
            <div className="flex w-full items-start justify-center bg-surface pb-nav">
                <div className="w-full max-w-5xl px-6 pt-6">
                    <PageTitle
                        en="EMPLOYEES"
                        description={
                            admin
                                ? '社員の追加・編集・無効化ができます。無効化した社員はログインできなくなりますが、過去の貸出履歴は残ります。'
                                : canManageSomeone
                                  ? '登録されている社員の一覧です。同じ班のメンバーは、パスワードの初期化とロックの解除ができます。'
                                  : '登録されている社員の一覧です。編集は管理者のみ行えます。'
                        }
                    >
                        社員一覧
                    </PageTitle>

                    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                        <p className="text-xl font-extrabold">
                            {filtered.length} 名
                            {keyword && (
                                <span className="ml-2 text-base font-bold text-sub">（全 {all.length} 名中）</span>
                            )}
                        </p>
                        {admin && (
                            <Button icon="＋" onClick={() => setEditing('new')}>
                                社員を追加
                            </Button>
                        )}
                    </div>

                    <SearchBar
                        keyword={keyword}
                        onChange={setKeyword}
                        label="社員を検索"
                        placeholder="社員名 / 社員ID / 班 で検索"
                    />

                    {admin && (
                        <label className="mb-4 flex min-h-touch items-center gap-4">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                            />
                            <span className="text-lg font-bold">無効化した社員も表示する</span>
                        </label>
                    )}

                    {message && (
                        <p role="status" className="pb-4 text-lg font-bold text-state-good">
                            {message}
                        </p>
                    )}
                    {actionError && (
                        <p role="alert" className="pb-4 text-lg font-bold text-accent">
                            ✕ {actionError}
                        </p>
                    )}

                    {loading && !employees ? (
                        <Loading />
                    ) : error && !employees ? (
                        <ErrorMessage message={error} onRetry={reload} />
                    ) : filtered.length === 0 ? (
                        <Empty>該当する社員がいません</Empty>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {filtered.map((employee) => (
                                <EmployeeCard
                                    key={employee.id}
                                    employee={employee}
                                    isMe={employee.id === user?.id}
                                    canEdit={admin}
                                    busy={busy}
                                    onEdit={() => setEditing(employee)}
                                    onReset={() => setResetTarget(employee)}
                                    onUnlock={() =>
                                        run(
                                            () => unlockEmployee(employee.id),
                                            `${employee.name} のロックを解除しました。`
                                        )
                                    }
                                    onDeactivate={() =>
                                        setConfirm({
                                            text: `${employee.name} を無効化しますか？（ログインできなくなります。履歴は残ります）`,
                                            yesText: '無効化する',
                                            danger: true,
                                            action: () =>
                                                run(
                                                    () => deactivateEmployee(employee.id),
                                                    `${employee.name} を無効化しました。`
                                                ),
                                        })
                                    }
                                    onRestore={() =>
                                        setConfirm({
                                            text: `${employee.name} を元に戻しますか？（再びログインできるようになります）`,
                                            yesText: '元に戻す',
                                            action: () =>
                                                run(
                                                    () => restoreEmployee(employee.id),
                                                    `${employee.name} を元に戻しました。`
                                                ),
                                        })
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <EmployeeModal
                isOpen={editing !== null}
                setIsOpen={(open) => !open && setEditing(null)}
                employee={editing === 'new' ? null : editing}
                isMe={editing !== 'new' && editing?.id === user?.id}
                teams={[...new Set(all.map((e) => e.team).filter(Boolean))]}
                onSaved={() => {
                    setEditing(null)
                    setMessage('保存しました。')
                    reload()
                }}
            />

            <ResetPasswordModal
                employee={resetTarget}
                onClose={() => setResetTarget(null)}
                onDone={(employee) => {
                    setResetTarget(null)
                    setMessage(
                        `${employee.name} のパスワードを初期化しました。新しいパスワードを本人に伝えてください（次のログインで変更が必要です）。`
                    )
                    reload()
                }}
            />

            <ConfirmModal
                isOpen={confirm !== null}
                setIsOpen={(open) => !open && setConfirm(null)}
                text={confirm?.text ?? ''}
                yesText={confirm?.yesText ?? ''}
                noText="やめる"
                setBoolean={(yes) => yes && confirm?.action()}
                borderColor={confirm?.danger ? 'border-accent' : 'border-main'}
                danger={Boolean(confirm?.danger)}
            />
        </>
    )
}

export default EmployeeList
