import { useCallback, useState } from 'react'
import PageTitle from '../Util/PageTitle'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import { getCategories } from '../../utils/toolInfo'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'
import { useFetch } from '../../hooks/useFetch'
import { useAuth } from '../../auth/AuthContext'
import {
    createInspectionItem,
    deleteInspectionItem,
    fetchInspectionItems,
    fetchTools,
    reorderInspectionItems,
    updateInspectionItem,
} from '../../api'

const inputClass = 'min-h-touch w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold'

// 点検項目1件。名前の変更・並び替え・削除ができる。
const ItemRow = ({ item, index, count, busy, onRename, onMove, onDelete }) => {
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(item.name)

    return (
        <li className="rounded-2xl border-2 border-ink bg-surface p-4">
            {editing ? (
                <div className="flex flex-col gap-3">
                    <label htmlFor={`item-name-${item.id}`} className="text-base text-sub">
                        項目名
                    </label>
                    <input
                        id={`item-name-${item.id}`}
                        type="text"
                        value={name}
                        maxLength={64}
                        onChange={(e) => setName(e.target.value)}
                        className={inputClass}
                    />
                    <div className="flex flex-wrap gap-3">
                        <Button
                            size="md"
                            disabled={busy || !name.trim() || name.trim() === item.name}
                            onClick={async () => {
                                if (await onRename(item, name.trim())) setEditing(false)
                            }}
                        >
                            保存
                        </Button>
                        <Button
                            size="md"
                            variant="secondary"
                            onClick={() => {
                                setName(item.name)
                                setEditing(false)
                            }}
                        >
                            やめる
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-4">
                    <span className="w-10 shrink-0 text-center text-xl font-extrabold text-sub">{index + 1}</span>
                    <div className="min-w-48 flex-1">
                        <p className="text-xl font-extrabold">{item.name}</p>
                        <p className="text-base text-sub">{item.toolCount} 件の工具で使用中</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="md"
                            variant="secondary"
                            disabled={busy || index === 0}
                            onClick={() => onMove(index, -1)}
                            aria-label={`${item.name}を上へ`}
                        >
                            ↑
                        </Button>
                        <Button
                            size="md"
                            variant="secondary"
                            disabled={busy || index === count - 1}
                            onClick={() => onMove(index, 1)}
                            aria-label={`${item.name}を下へ`}
                        >
                            ↓
                        </Button>
                        <Button size="md" variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
                            名前を変更
                        </Button>
                        <Button size="md" variant="danger" disabled={busy} onClick={() => onDelete(item)}>
                            削除
                        </Button>
                    </div>
                </div>
            )}
        </li>
    )
}

// 管理者向け：点検項目の管理。
// ここで追加した項目を、工具ごと（工具リストの詳細 →「点検」タブ）に割り当てて使う。
// 追加するときに大項目を選ぶと、その大項目の工具すべてにまとめて割り当てられる。
const InspectionItems = () => {
    const { user } = useAuth()
    const isAdmin = user?.permission === '管理者'

    const loadItems = useCallback(() => fetchInspectionItems(), [])
    const { data: items, loading, error, reload, setData } = useFetch(loadItems, { enabled: isAdmin })
    const loadTools = useCallback(() => fetchTools(), [])
    const { data: tools } = useFetch(loadTools, { enabled: isAdmin })
    const categories = getCategories(tools)

    const [name, setName] = useState('')
    const [targets, setTargets] = useState([])
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [actionError, setActionError] = useState('')
    const [deleting, setDeleting] = useState(null)

    const run = async (action, success) => {
        setBusy(true)
        setMessage('')
        setActionError('')
        try {
            await action()
            setMessage(success)
            reload()
            return true
        } catch (err) {
            setActionError(err.message)
            return false
        } finally {
            setBusy(false)
        }
    }

    const add = async () => {
        const ok = await run(
            () => createInspectionItem({ name: name.trim(), categories: targets }),
            `「${name.trim()}」を追加しました。${targets.length ? `（${targets.join('・')} の工具に割り当て）` : ''}`
        )
        if (ok) {
            setName('')
            setTargets([])
        }
    }

    const move = (index, delta) => {
        const next = [...items]
        const [moved] = next.splice(index, 1)
        next.splice(index + delta, 0, moved)
        setData(next) // 先に並びを反映して、押した手応えをすぐ返す
        run(() => reorderInspectionItems(next.map((i) => i.id)), '並び順を変更しました。')
    }

    if (!isAdmin) {
        return (
            <div className="px-6 pt-8 pb-nav">
                <PageTitle en="INSPECTION">点検項目の管理</PageTitle>
                <p className="text-xl font-bold text-sub">この画面は管理者のみ使用できます。</p>
            </div>
        )
    }

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-8">
                <PageTitle
                    en="INSPECTION"
                    description="点検項目を追加し、工具ごとに割り当てます（工具リストの詳細 →「点検」タブ）。"
                >
                    点検項目の管理
                </PageTitle>

                <section className="mb-8 rounded-2xl border-2 border-line bg-field p-5">
                    <h2 className="pb-3 text-2xl font-extrabold">項目を追加</h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="new-item-name" className="text-lg font-bold">
                                項目名<span className="ml-2 text-base text-accent">※必須</span>
                            </label>
                            <input
                                id="new-item-name"
                                type="text"
                                value={name}
                                maxLength={64}
                                placeholder="例：刃こぼれ・摩耗がない"
                                onChange={(e) => setName(e.target.value)}
                                className={inputClass}
                            />
                        </div>

                        {categories.length > 0 && (
                            <fieldset>
                                <legend className="pb-2 text-lg font-bold">
                                    まとめて割り当てる大項目
                                    <span className="ml-2 text-base font-medium text-sub">（任意・後から工具ごとに変更できます）</span>
                                </legend>
                                <div className="flex flex-wrap gap-2">
                                    {categories.map((c) => {
                                        const checked = targets.includes(c)
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                role="checkbox"
                                                aria-checked={checked}
                                                onClick={() =>
                                                    setTargets(checked ? targets.filter((t) => t !== c) : [...targets, c])
                                                }
                                                className={`min-h-touch rounded-xl px-4 text-lg font-extrabold ${
                                                    checked
                                                        ? 'border-4 border-main bg-main text-surface'
                                                        : 'border-2 border-ink bg-surface'
                                                }`}
                                            >
                                                {checked && (
                                                    <span aria-hidden="true" className="mr-1">
                                                        ✓
                                                    </span>
                                                )}
                                                {c}
                                            </button>
                                        )
                                    })}
                                </div>
                            </fieldset>
                        )}

                        <Button onClick={add} disabled={busy || !name.trim()}>
                            {busy ? '処理中...' : 'この項目を追加する'}
                        </Button>
                    </div>
                </section>

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

                <h2 className="pb-3 text-2xl font-extrabold">登録済みの項目</h2>
                {loading ? (
                    <Loading />
                ) : error ? (
                    <ErrorMessage message={error} onRetry={reload} />
                ) : (items ?? []).length === 0 ? (
                    <Empty>点検項目はまだありません</Empty>
                ) : (
                    <ul className="flex flex-col gap-4">
                        {items.map((item, i) => (
                            <ItemRow
                                key={item.id}
                                item={item}
                                index={i}
                                count={items.length}
                                busy={busy}
                                onRename={(it, newName) =>
                                    run(() => updateInspectionItem({ id: it.id, name: newName }), '名前を変更しました。')
                                }
                                onMove={move}
                                onDelete={setDeleting}
                            />
                        ))}
                    </ul>
                )}
            </div>

            <ConfirmModal
                isOpen={deleting !== null}
                setIsOpen={(open) => !open && setDeleting(null)}
                text={`「${deleting?.name ?? ''}」を削除しますか？${
                    deleting?.toolCount ? `（${deleting.toolCount} 件の工具から外れます）` : ''
                }`}
                yesText="削除する"
                noText="やめる"
                borderColor="border-accent"
                danger
                setBoolean={(yes) => {
                    const target = deleting
                    setDeleting(null)
                    if (yes && target) run(() => deleteInspectionItem(target.id), `「${target.name}」を削除しました。`)
                }}
            />
        </div>
    )
}

export default InspectionItems
