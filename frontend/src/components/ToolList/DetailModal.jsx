import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../Util/Modal'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import StateBadge from '../Util/StateBadge'
import DefectRankBadge from '../Util/DefectRankBadge'
import DefectFields from '../Util/DefectFields'
import MapPicker from '../Util/MapPicker'
import Segmented from '../Util/Segmented'
import InfoRow from '../Util/InfoRow'
import ChoiceInput from '../Util/ChoiceInput'
import { TOOL_STATES } from '../../utils/toolState'
import { formatPurchase, getPurchaseAge } from '../../utils/toolInfo'
import { fetchInspectionItems, fetchTool, inspectTool, resolveImageUrl, updateTool } from '../../api'
import { useAuth } from '../../auth/AuthContext'

const inputClass = 'w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold'

const TABS = [
    { value: 'info', label: '基本情報' },
    { value: 'inspect', label: '点検' },
    { value: 'history', label: '履歴' },
]

// 更新履歴の「どの操作で変わったか」
const SOURCE_LABELS = {
    edit: '工具情報の編集',
    rent: '貸出時',
    return: '返却時',
    renew: '貸出の更新時',
    transfer: '引き渡し時',
    inspect: '点検時',
}

// 編集できる項目と、確認ダイアログに出す名前
const EDIT_FIELDS = [
    { key: 'name', label: '名前', admin: true },
    { key: 'category', label: '大項目', admin: true },
    { key: 'purchaseDate', label: '購入日', admin: true },
    { key: 'state', label: '状態' },
    { key: 'defectRank', label: '不良ランク' },
    { key: 'defectNote', label: '不良内容' },
    { key: 'lastInspectionDate', label: '最終点検日' },
]

const toForm = (tool) => ({
    name: tool.name ?? '',
    category: tool.category ?? '',
    purchaseDate: tool.purchaseDate ?? '',
    state: tool.state,
    defectRank: tool.defectRank ?? null,
    defectNote: tool.defectNote ?? '',
    lastInspectionDate: tool.lastInspectionDate ?? '',
    pin: tool.pin,
})

const SectionTitle = ({ children }) => <h3 className="pb-2 text-lg font-bold">{children}</h3>

const ListBox = ({ empty, children }) => (
    <div className="rounded-xl border-2 border-line bg-field p-4">
        {React.Children.count(children) === 0 ? (
            <p className="text-lg font-bold text-sub">{empty}</p>
        ) : (
            <ul className="flex flex-col gap-4">{children}</ul>
        )}
    </div>
)

/* ---------------- 基本情報 ---------------- */

const InfoTab = ({ tool, form, setForm, isAdmin, categories }) => {
    const age = getPurchaseAge(form.purchaseDate)
    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-5">
                <img
                    className="h-52 w-full rounded-xl border-2 border-ink object-contain"
                    src={resolveImageUrl(tool.photoUrl)}
                    alt={`${tool.name}の写真`}
                />

                {isAdmin ? (
                    <div className="flex flex-col gap-2">
                        <label htmlFor="tool-edit-name" className="text-lg font-bold">
                            名前
                        </label>
                        <input
                            id="tool-edit-name"
                            type="text"
                            value={form.name}
                            maxLength={30}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className={inputClass}
                        />
                    </div>
                ) : (
                    <InfoRow label="名前">{tool.name}</InfoRow>
                )}

                <InfoRow label="ID">{tool.id}</InfoRow>

                {isAdmin ? (
                    <div className="flex flex-col gap-2">
                        <label htmlFor="tool-edit-category" className="text-lg font-bold">
                            大項目
                        </label>
                        <ChoiceInput
                            id="tool-edit-category"
                            value={form.category}
                            options={categories}
                            maxLength={32}
                            placeholder="切断工具"
                            onChange={(category) => setForm({ ...form, category })}
                            className={inputClass}
                        />
                    </div>
                ) : (
                    <InfoRow label="大項目">{tool.category || '―'}</InfoRow>
                )}

                {isAdmin ? (
                    <div className="flex flex-col gap-2">
                        <label htmlFor="tool-edit-purchase" className="text-lg font-bold">
                            購入日
                            {age && (
                                <span className="ml-3 text-base font-bold text-sub">
                                    購入から {age.label}
                                </span>
                            )}
                        </label>
                        <input
                            id="tool-edit-purchase"
                            type="date"
                            value={form.purchaseDate}
                            onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                            className={inputClass}
                        />
                    </div>
                ) : (
                    <InfoRow label="購入日">{formatPurchase(tool.purchaseDate)}</InfoRow>
                )}

                <InfoRow label="現在の状態">
                    <span className="flex flex-wrap gap-2">
                        <StateBadge state={tool.state} size="lg" />
                        <DefectRankBadge rank={tool.defectRank} size="lg" />
                    </span>
                </InfoRow>

                <div className="flex flex-col gap-2">
                    <label htmlFor="tool-state" className="text-lg font-bold">
                        状態を変更する
                    </label>
                    <select
                        id="tool-state"
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                        className={inputClass}
                    >
                        {TOOL_STATES.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </div>

                {form.state !== 'good' && (
                    <DefectFields
                        idPrefix="tool"
                        rank={form.defectRank}
                        note={form.defectNote}
                        onChange={({ rank, note }) => setForm({ ...form, defectRank: rank, defectNote: note })}
                    />
                )}
            </div>

            <div className="flex flex-col gap-6">
                <MapPicker pin={form.pin} setPin={(pin) => setForm({ ...form, pin })} label="持ち出し場所" />

                <div className="flex flex-col gap-2">
                    <label htmlFor="tool-inspection" className="text-lg font-bold">
                        最終点検日
                    </label>
                    <input
                        id="tool-inspection"
                        type="date"
                        value={form.lastInspectionDate}
                        onChange={(e) => setForm({ ...form, lastInspectionDate: e.target.value })}
                        className={inputClass}
                    />
                    <p className="text-base text-sub">「点検」タブで点検を記録すると自動で更新されます。</p>
                </div>

                <div>
                    <SectionTitle>貸出状況</SectionTitle>
                    {tool.isRented ? (
                        <div className="rounded-xl border-4 border-accent p-4 text-lg font-bold">
                            <p className="font-extrabold text-accent">貸出中</p>
                            <p>
                                <span className="mr-2 text-base text-sub">使用者</span>
                                {tool.user}
                                {tool.takenBy && tool.takenBy !== tool.user && (
                                    <span className="ml-2 text-base text-sub">（代理：{tool.takenBy}）</span>
                                )}
                            </p>
                            <p>
                                <span className="mr-2 text-base text-sub">持出</span>
                                {tool.takenAt || tool.startDate}
                            </p>
                            <p>
                                <span className="mr-2 text-base text-sub">返却予定</span>
                                {tool.endDate}
                            </p>
                        </div>
                    ) : (
                        <p className="rounded-xl border-4 border-available p-4 text-lg font-extrabold text-available">
                            貸出可能
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ---------------- 点検 ---------------- */

// 点検項目ごとの OK / NG
const RESULT_OPTIONS = [
    { value: 'ok', label: '● OK' },
    { value: 'ng', label: '✕ NG' },
]

const InspectTab = ({ tool, check, setCheck, isAdmin, assign, setAssign, allItems, onSaveAssign, savingAssign }) => {
    const items = tool.inspectionItems ?? []
    const ngItems = items.filter((i) => check.results[i.id] === 'ng')

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-5">
                <SectionTitle>点検する</SectionTitle>
                {items.length === 0 ? (
                    <p className="rounded-xl border-2 border-line bg-field p-4 text-lg font-bold text-sub">
                        この工具には点検項目が設定されていません。
                        {isAdmin ? '右の「点検項目の設定」で選んでください。' : '管理者に設定を依頼してください。'}
                    </p>
                ) : (
                    <>
                        <Button
                            variant="secondary"
                            size="md"
                            onClick={() =>
                                setCheck({
                                    ...check,
                                    results: Object.fromEntries(items.map((i) => [i.id, 'ok'])),
                                })
                            }
                        >
                            すべて OK にする
                        </Button>
                        <ul className="flex flex-col gap-4">
                            {items.map((item) => (
                                <li key={item.id} className="rounded-xl border-2 border-ink p-3">
                                    <p className="pb-2 text-lg font-extrabold">{item.name}</p>
                                    <Segmented
                                        label={item.name}
                                        options={RESULT_OPTIONS}
                                        value={check.results[item.id]}
                                        onChange={(v) =>
                                            setCheck({ ...check, results: { ...check.results, [item.id]: v } })
                                        }
                                    />
                                </li>
                            ))}
                        </ul>

                        {ngItems.length > 0 && (
                            <div className="flex flex-col gap-3">
                                <p role="status" className="text-lg font-extrabold text-state-bad">
                                    ▲ NG の項目があります。記録すると工具の状態は「不良」になります。
                                </p>
                                <DefectFields
                                    idPrefix="inspect"
                                    rank={check.defectRank}
                                    note={check.defectNote}
                                    onChange={({ rank, note }) =>
                                        setCheck({ ...check, defectRank: rank, defectNote: note })
                                    }
                                />
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label htmlFor="inspect-note" className="text-base text-sub">
                                メモ（任意）
                            </label>
                            <textarea
                                id="inspect-note"
                                rows={2}
                                maxLength={1000}
                                value={check.note}
                                onChange={(e) => setCheck({ ...check, note: e.target.value })}
                                className="w-full rounded-xl border-2 border-ink bg-surface px-4 py-3 text-lg font-bold"
                            />
                        </div>
                    </>
                )}
            </div>

            <div className="flex flex-col gap-6">
                <div>
                    <SectionTitle>点検の記録</SectionTitle>
                    <ListBox empty="点検の記録はありません">
                        {(tool.inspections ?? []).map((n) => {
                            const ng = n.results.filter((r) => !r.ok)
                            return (
                                <li key={n.id} className="text-lg font-bold">
                                    <span className={n.result === 'ng' ? 'text-accent' : 'text-state-good'}>
                                        {n.result === 'ng' ? '✕ NG' : '● OK'}
                                    </span>
                                    <span className="ml-3">{n.inspectedAt}</span>
                                    <span className="ml-3 font-medium text-sub">{n.employee}</span>
                                    {ng.length > 0 && (
                                        <p className="text-base text-accent">NG：{ng.map((r) => r.name).join('、')}</p>
                                    )}
                                    {n.note && <p className="text-base font-medium text-sub">{n.note}</p>}
                                </li>
                            )
                        })}
                    </ListBox>
                </div>

                {isAdmin && (
                    <div>
                        <SectionTitle>点検項目の設定（管理者）</SectionTitle>
                        <div className="flex flex-col gap-3 rounded-xl border-2 border-line p-4">
                            {allItems === null ? (
                                <p className="text-lg font-bold text-sub">読み込み中...</p>
                            ) : allItems.length === 0 ? (
                                <p className="text-lg font-bold text-sub">点検項目がまだありません。</p>
                            ) : (
                                allItems.map((item) => (
                                    <label key={item.id} className="flex min-h-touch items-center gap-4">
                                        <input
                                            type="checkbox"
                                            checked={assign.includes(item.id)}
                                            onChange={(e) =>
                                                setAssign(
                                                    e.target.checked
                                                        ? [...assign, item.id]
                                                        : assign.filter((id) => id !== item.id)
                                                )
                                            }
                                        />
                                        <span className="text-lg font-bold">{item.name}</span>
                                    </label>
                                ))
                            )}
                            <div className="flex flex-wrap gap-3 pt-2">
                                <Button size="md" onClick={onSaveAssign} disabled={savingAssign || allItems === null}>
                                    {savingAssign ? '保存中...' : '点検項目を保存'}
                                </Button>
                                <Link
                                    to="/inspection-items"
                                    className="touch-target inline-flex items-center rounded-xl border-2 border-ink px-6 text-lg font-extrabold"
                                >
                                    項目を追加・編集
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ---------------- 履歴 ---------------- */

const HistoryTab = ({ tool }) => (
    <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
            <div>
                <SectionTitle>予約</SectionTitle>
                <ListBox empty="予約はありません">
                    {(tool.reservations ?? []).map((r) => (
                        <li key={r.rentalId} className="text-lg font-bold">
                            {r.label}
                            <span className="ml-3 font-medium text-sub">{r.user}</span>
                        </li>
                    ))}
                </ListBox>
            </div>

            <div>
                <SectionTitle>使用履歴</SectionTitle>
                <ListBox empty="履歴はありません">
                    {(tool.history ?? []).map((h) => (
                        <li key={h.rentalId} className="text-lg font-bold">
                            <p>
                                {h.user}
                                {h.status === 'renting' && (
                                    <span className="ml-3 font-extrabold text-accent">貸出中</span>
                                )}
                            </p>
                            <p className="text-base">
                                <span className="mr-2 text-sub">持出</span>
                                {h.takenAt}
                                {h.takenBy && <span className="ml-2 text-sub">（代理：{h.takenBy}）</span>}
                            </p>
                            <p className="text-base">
                                {h.status === 'renting' ? (
                                    <>
                                        <span className="mr-2 text-sub">返却予定</span>
                                        {h.endLabel}
                                    </>
                                ) : (
                                    <>
                                        <span className="mr-2 text-sub">返却</span>
                                        {h.returnedAt || '―'}
                                        {h.returnedBy && (
                                            <span className="ml-2 text-sub">（代理：{h.returnedBy}）</span>
                                        )}
                                    </>
                                )}
                            </p>
                        </li>
                    ))}
                </ListBox>
            </div>
        </div>

        <div>
            <SectionTitle>更新履歴</SectionTitle>
            <ListBox empty="更新履歴はありません">
                {(tool.changeLogs ?? []).map((log) => (
                    <li key={log.id}>
                        <p className="text-lg font-bold">
                            {log.changedAt}
                            <span className="ml-3 font-medium text-sub">{log.employee}</span>
                        </p>
                        <p className="text-base text-sub">{SOURCE_LABELS[log.source] ?? log.source}</p>
                        <dl className="mt-1 flex flex-col gap-1 border-l-4 border-steel pl-3">
                            {log.changes.map((c, i) => (
                                <div key={i} className="text-base font-bold">
                                    <dt className="inline text-sub">{c.label}：</dt>
                                    <dd className="inline">
                                        <span className="text-sub line-through decoration-2">{c.from}</span>
                                        <span aria-label="から" className="mx-2">
                                            →
                                        </span>
                                        {c.to}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </li>
                ))}
            </ListBox>
        </div>
    </div>
)

/* ---------------- 本体 ---------------- */

const emptyCheck = () => ({ results: {}, note: '', state: 'bad', defectRank: null, defectNote: '' })

const DetailModal = ({ isOpen, setIsOpen, toolId, categories = [], onUpdated }) => {
    const { user } = useAuth()
    const isAdmin = user?.permission === '管理者'

    const [tab, setTab] = useState('info')
    const [tool, setTool] = useState(null)
    const [form, setForm] = useState(null)
    const [check, setCheck] = useState(emptyCheck)
    const [assign, setAssign] = useState([])
    const [allItems, setAllItems] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    // 確認ダイアログの内容 { text, yesText, action }。閉じるアニメーション中も文言を残すため開閉は別に持つ
    const [confirm, setConfirm] = useState(null)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const ask = (c) => {
        setConfirm(c)
        setIsConfirmOpen(true)
    }
    const [nonce, setNonce] = useState(0)

    const refresh = useCallback(() => setNonce((n) => n + 1), [])

    // 開いたとき（と保存後）に最新の工具詳細（履歴込み）を取得する
    useEffect(() => {
        if (!isOpen || !toolId) return
        let ignore = false
        setLoading(true)
        fetchTool(toolId)
            .then((data) => {
                if (ignore) return
                setTool(data)
                setForm(toForm(data))
                setAssign((data.inspectionItems ?? []).map((i) => i.id))
            })
            .catch((err) => {
                if (!ignore) setError(err.message)
            })
            .finally(() => {
                if (!ignore) setLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [isOpen, toolId, nonce])

    // 別の工具を開いたら、タブや入力途中の内容を初期状態に戻す
    useEffect(() => {
        if (!isOpen) return
        setTab('info')
        setCheck(emptyCheck())
        setError('')
        setMessage('')
        setTool(null)
    }, [isOpen, toolId])

    // 管理者は点検項目の割り当てができるので、マスタも取っておく
    useEffect(() => {
        if (!isOpen || !isAdmin) return
        let ignore = false
        fetchInspectionItems()
            .then((items) => !ignore && setAllItems(items))
            .catch(() => !ignore && setAllItems([]))
        return () => {
            ignore = true
        }
    }, [isOpen, isAdmin])

    const run = async (action, successMessage) => {
        setIsConfirmOpen(false)
        setSaving(true)
        setError('')
        setMessage('')
        try {
            await action()
            setMessage(successMessage)
            refresh()
            onUpdated?.()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    /* 基本情報の保存 */
    const changedFields = tool && form
        ? EDIT_FIELDS.filter(
              (f) =>
                  (isAdmin || !f.admin) &&
                  (form.state !== 'good' || (f.key !== 'defectRank' && f.key !== 'defectNote')) &&
                  (form[f.key] ?? '') !== (toForm(tool)[f.key] ?? '')
          ).map((f) => f.label)
        : []
    if (tool && form && (form.pin?.x !== tool.pin?.x || form.pin?.y !== tool.pin?.y)) changedFields.push('持ち出し場所')

    const saveInfo = () =>
        run(
            () =>
                updateTool({
                    id: tool.id,
                    state: form.state,
                    defectRank: form.state === 'good' ? null : form.defectRank,
                    defectNote: form.state === 'good' ? '' : form.defectNote,
                    lastInspectionDate: form.lastInspectionDate || null,
                    pin: form.pin,
                    ...(isAdmin && {
                        name: form.name.trim(),
                        category: form.category.trim(),
                        purchaseDate: form.purchaseDate || null,
                    }),
                }),
            '工具情報を更新しました。変更内容は「履歴」タブで確認できます。'
        )

    /* 点検の記録 */
    const items = tool?.inspectionItems ?? []
    const answered = items.length > 0 && items.every((i) => check.results[i.id])
    const ngNames = items.filter((i) => check.results[i.id] === 'ng').map((i) => i.name)

    const saveInspection = () =>
        run(async () => {
            await inspectTool({
                toolId: tool.id,
                results: items.map((i) => ({ itemId: i.id, ok: check.results[i.id] === 'ok' })),
                note: check.note,
                // NG があるときだけ状態も更新する。内容が空なら NG の項目名を入れておく。
                ...(ngNames.length > 0 && {
                    state: check.state,
                    defectRank: check.defectRank,
                    defectNote: check.defectNote.trim() || `点検NG：${ngNames.join('、')}`,
                }),
            })
            setCheck(emptyCheck())
        }, '点検結果を記録しました。')

    const saveAssign = () =>
        run(() => updateTool({ id: tool.id, inspectionItemIds: assign }), '点検項目を保存しました。')

    const footer = tool && form && tab !== 'history' && (
        <>
            {error && (
                <p role="alert" className="whitespace-pre-line pb-3 text-lg font-bold text-accent">
                    ✕ {error}
                </p>
            )}
            {message && (
                <p role="status" className="pb-3 text-lg font-bold text-state-good">
                    {message}
                </p>
            )}
            {tab === 'info' ? (
                <Button
                    className="w-full"
                    disabled={saving || changedFields.length === 0 || (isAdmin && !form.name.trim())}
                    onClick={() =>
                        ask({
                            text: `${changedFields.join('・')} を更新しますか？`,
                            yesText: '更新する',
                            action: saveInfo,
                        })
                    }
                >
                    {saving ? '更新中...' : changedFields.length === 0 ? '変更はありません' : '変更を保存する'}
                </Button>
            ) : (
                <Button
                    className="w-full"
                    disabled={saving || !answered}
                    onClick={() =>
                        ask({
                            text:
                                ngNames.length > 0
                                    ? `NG ${ngNames.length} 件で点検を記録しますか？`
                                    : 'すべて OK で点検を記録しますか？',
                            yesText: '記録する',
                            action: saveInspection,
                        })
                    }
                >
                    {saving
                        ? '記録中...'
                        : items.length === 0
                          ? '点検項目がありません'
                          : answered
                            ? '点検結果を記録する'
                            : `未チェック ${items.filter((i) => !check.results[i.id]).length} 件`}
                </Button>
            )}
        </>
    )

    return (
        <>
            <Modal isOpen={isOpen} setIsOpen={setIsOpen} title="工具の詳細" subtitle={tool?.name} footer={footer}>
                {loading && !tool ? (
                    <p role="status" className="py-16 text-center text-xl font-bold text-sub">
                        読み込み中...
                    </p>
                ) : !tool || !form ? (
                    <p role="alert" className="py-16 text-center text-xl font-bold text-accent">
                        {error || '工具が見つかりません'}
                    </p>
                ) : (
                    <>
                        <Segmented
                            label="表示する内容"
                            options={TABS}
                            value={tab}
                            onChange={(v) => {
                                setTab(v)
                                setError('')
                                setMessage('')
                            }}
                            className="mb-6"
                        />
                        {tab === 'info' && (
                            <InfoTab
                                tool={tool}
                                form={form}
                                setForm={setForm}
                                isAdmin={isAdmin}
                                categories={categories}
                            />
                        )}
                        {tab === 'inspect' && (
                            <InspectTab
                                tool={tool}
                                check={check}
                                setCheck={setCheck}
                                isAdmin={isAdmin}
                                assign={assign}
                                setAssign={setAssign}
                                allItems={allItems}
                                onSaveAssign={saveAssign}
                                savingAssign={saving}
                            />
                        )}
                        {tab === 'history' && <HistoryTab tool={tool} />}
                    </>
                )}
            </Modal>

            <ConfirmModal
                isOpen={isConfirmOpen}
                setIsOpen={setIsConfirmOpen}
                text={confirm?.text ?? ''}
                yesText={confirm?.yesText ?? ''}
                noText="やめる"
                setBoolean={(yes) => yes && confirm?.action()}
            />
        </>
    )
}

export default DetailModal
