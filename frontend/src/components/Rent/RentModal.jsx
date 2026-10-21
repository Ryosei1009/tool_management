import React, { useCallback, useEffect, useState } from 'react'
import Modal from '../Util/Modal'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import StateBadge from '../Util/StateBadge'
import DefectRankBadge from '../Util/DefectRankBadge'
import MapPicker from '../Util/MapPicker'
import Segmented from '../Util/Segmented'
import SlotInput from '../Util/SlotInput'
import ConflictAlert from '../Util/ConflictAlert'
import InfoRow from '../Util/InfoRow'
import { defaultRentPeriod, notFoundTool, toRentTool } from '../../utils/tools'
import { isRope } from '../../utils/toolInfo'
import { currentSlot, findConflicts, slotKey, toolOccupancy } from '../../utils/period'
import { createRental, fetchEmployees, fetchTool, resolveImageUrl } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { useFetch } from '../../hooks/useFetch'

const MODES = [
    { value: 'rent', label: '今すぐ借りる' },
    { value: 'reserve', label: '予約する' },
]

const RentModal = ({ isOpen, setIsOpen, toolId, onRented }) => {
    const { user } = useAuth()
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [tool, setTool] = useState(() => notFoundTool(toolId))
    const [mode, setMode] = useState('rent')
    const [borrowerId, setBorrowerId] = useState(user?.id)
    // ロープを借りるときの「荷重に問題がないことを確認した」
    const [loadChecked, setLoadChecked] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // 代理で借りられる相手（同じ班のメンバー）
    const loadEmployees = useCallback(() => fetchEmployees(), [])
    const { data: employees } = useFetch(loadEmployees, { enabled: isOpen && Boolean(user?.team) })
    const teammates = (employees ?? []).filter((e) => e.team && e.team === user?.team && e.id !== user?.id)
    const borrower = borrowerId === user?.id ? user : teammates.find((e) => e.id === borrowerId)

    // QR/検索で得た ID から工具をサーバーに問い合わせる。
    // 持ち出し場所の初期値は、借りる人がマイページで登録した既定の場所（未設定なら工具の現在地）。
    useEffect(() => {
        if (!isOpen || !toolId) return
        let ignore = false
        setLoading(true)
        setError('')
        setBorrowerId(user?.id)
        setLoadChecked(false)
        fetchTool(toolId)
            .then((data) => {
                if (ignore) return
                setTool(toRentTool(data, user?.defaultPin))
                // 貸出中の工具は予約だけできる
                setMode(data.isRented ? 'reserve' : 'rent')
            })
            .catch((err) => {
                if (ignore) return
                // 404 は「該当なし」表示、それ以外は通信エラーとして出す
                setTool(notFoundTool(toolId))
                if (err.status !== 404) setError(err.message)
            })
            .finally(() => {
                if (!ignore) setLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [isOpen, toolId, user?.defaultPin, user?.id])

    const changeBorrower = (id) => {
        setBorrowerId(id)
        // 代理で借りるときは、持ち出し場所の初期値もその人の既定の場所にする
        const next = id === user?.id ? user : teammates.find((e) => e.id === id)
        if (next?.defaultPin) setTool((t) => ({ ...t, pin: next.defaultPin }))
    }

    const now = currentSlot()
    const period = tool.lastRent ?? defaultRentPeriod()
    const setPeriod = (patch) => setTool((t) => ({ ...t, lastRent: { ...t.lastRent, ...patch } }))

    // 今すぐ借りるときは「今」から返却予定まで、予約は入力した期間で重なりを調べる
    const range =
        mode === 'rent'
            ? { start: slotKey(now.date, now.period), end: slotKey(period.end, period.endPeriod) }
            : { start: slotKey(period.start, period.startPeriod), end: slotKey(period.end, period.endPeriod) }
    const invalidRange = range.start > range.end
    const occupancy = tool.notFound ? [] : toolOccupancy(tool)
    // 借りる人自身の予約は、今すぐ借りるときにはその予約を使って持ち出すので重なりとみなさない
    const ownReservation =
        mode === 'rent'
            ? occupancy.find((e) => !e.renting && e.userId === borrowerId && findConflicts(range, [e]).length > 0)
            : null
    const conflicts = findConflicts(range, occupancy, ownReservation?.rentalId)
    const pastReserve = mode === 'reserve' && range.start < slotKey(now.date, now.period)
    // 荷重の確認は、ロープを今すぐ借りる（持ち出す）ときだけ求める
    const needsLoadCheck = mode === 'rent' && !tool.notFound && isRope(tool.category)

    const submit = () => {
        setIsConfirmOpen(false)
        if (saving) return
        setSaving(true)
        setError('')
        createRental({
            toolId: tool.id,
            mode,
            employeeId: borrowerId,
            startDate: period.start,
            startPeriod: period.startPeriod,
            endDate: period.end,
            endPeriod: period.endPeriod,
            pin: mode === 'rent' ? tool.pin : undefined,
            loadChecked: needsLoadCheck ? loadChecked : undefined,
        })
            .then(() => {
                setIsOpen(false)
                onRented?.({ mode, toolName: tool.name, proxyName: proxy ? borrower?.name : null })
            })
            .catch((err) => setError(err.message))
            .finally(() => setSaving(false))
    }

    const disabled =
        tool.notFound ||
        loading ||
        saving ||
        (mode === 'rent' && tool.isRented) ||
        invalidRange ||
        pastReserve ||
        conflicts.length > 0 ||
        (needsLoadCheck && !loadChecked)

    const buttonLabel = tool.notFound
        ? '該当する工具がありません'
        : saving
            ? '登録中...'
            : conflicts.length > 0
                ? '期間が重なっています'
                : invalidRange
                    ? '返却予定を開始より後にしてください'
                    : pastReserve
                        ? '過去の日時は予約できません'
                        : needsLoadCheck && !loadChecked
                        ? '荷重の確認にチェックしてください'
                        : mode === 'rent'
                            ? 'この内容で借りる'
                            : 'この内容で予約する'

    const proxy = borrowerId !== user?.id
    const confirmText = `${proxy ? `${borrower?.name ?? ''} さんの代わりに ` : ''}${tool.name} を${mode === 'rent' ? '借りますか？' : '予約しますか？'
        }`

    return (
        <>
            <Modal
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                title={mode === 'rent' ? '工具を借りる' : '工具を予約する'}
                subtitle={loading ? '読み込み中...' : tool.notFound ? '該当なし' : tool.name}
                footer={
                    <>
                        {error && (
                            <p role="alert" className="whitespace-pre-line pb-3 text-lg font-bold text-accent">
                                ✕ {error}
                            </p>
                        )}
                        <Button className="w-full" onClick={() => setIsConfirmOpen(true)} disabled={disabled}>
                            {buttonLabel}
                        </Button>
                    </>
                }
            >
                <Segmented
                    label="借り方"
                    options={MODES.map((m) => (m.value === 'rent' && tool.isRented ? { ...m, disabled: true } : m))}
                    value={mode}
                    onChange={setMode}
                    size="lg"
                    className="mb-6"
                />
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="flex flex-col gap-5">
                        <img
                            className="h-52 w-full rounded-xl border-2 border-ink object-contain"
                            src={resolveImageUrl(tool.photoUrl)}
                            alt={tool.name ? `${tool.name}の写真` : ''}
                        />

                        <InfoRow label="名前">{tool.name || '―'}</InfoRow>
                        <InfoRow label="ID">{tool.id || '―'}</InfoRow>
                        <InfoRow label="状態">
                            <span className="flex flex-wrap gap-2">
                                <StateBadge state={tool.state} size="lg" />
                                <DefectRankBadge rank={tool.defectRank} size="lg" />
                            </span>
                        </InfoRow>
                        {tool.defectNote && (
                            <p className="rounded-xl border-2 border-state-bad p-3 text-lg font-bold">
                                <span className="mr-2 text-base text-sub">不良内容</span>
                                {tool.defectNote}
                            </p>
                        )}

                        {tool.isRented && (
                            <p className="rounded-xl border-4 border-accent p-4 text-lg font-bold">
                                <span className="block font-extrabold text-accent">
                                    貸出中のため、今すぐは借りられません
                                </span>
                                {tool.user}（返却予定 {tool.endDate}）
                            </p>
                        )}

                        {(tool.reservations ?? []).length > 0 && (
                            <div>
                                <p className="pb-2 text-lg font-bold">この工具の予約</p>
                                <ul className="flex flex-col gap-2 rounded-xl border-2 border-line bg-field p-4">
                                    {tool.reservations.map((r) => (
                                        <li key={r.rentalId} className="text-lg font-bold">
                                            {r.label}
                                            <span className="ml-2 font-medium text-sub">{r.user}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-6">
                        {/* 同じ班のメンバーがいれば代理で借りられる */}
                        {teammates.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <label htmlFor="rent-borrower" className="text-lg font-bold">
                                    借りる人
                                </label>
                                <select
                                    id="rent-borrower"
                                    value={borrowerId}
                                    onChange={(e) => changeBorrower(e.target.value)}
                                    className={`w-full rounded-xl bg-surface px-4 text-xl font-bold ${proxy ? 'border-4 border-main' : 'border-2 border-ink'
                                        }`}
                                >
                                    <option value={user?.id}>{user?.name} (自分）</option>
                                    {teammates.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.name}（代理）
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <fieldset className="flex flex-col gap-4">
                            <legend className="pb-1 text-lg font-bold">
                                {mode === 'rent' ? '借りる期間' : '予約する期間'}
                            </legend>
                            {mode === 'rent' ? (
                                <p className="border-b-2 border-dashed border-line pb-3 text-xl font-extrabold">
                                    <span className="mr-3 text-base font-medium text-sub">持ち出し</span>
                                    {new Date().toLocaleString('ja-JP', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            ) : (
                                <SlotInput
                                    id="rent-start"
                                    label="開始"
                                    date={period.start}
                                    period={period.startPeriod}
                                    min={now.date}
                                    onChange={({ date, period: p }) => setPeriod({ start: date, startPeriod: p })}
                                />
                            )}
                            <SlotInput
                                id="rent-end"
                                label="返却予定"
                                date={period.end}
                                period={period.endPeriod}
                                min={mode === 'rent' ? now.date : period.start}
                                onChange={({ date, period: p }) => setPeriod({ end: date, endPeriod: p })}
                            />
                        </fieldset>

                        {needsLoadCheck && (
                            <fieldset className="rounded-xl border-4 border-state-bad p-4">
                                <legend className="px-1 text-lg font-extrabold text-state-bad">
                                    <span aria-hidden="true">▲ </span>ロープの荷重の確認
                                </legend>
                                <p className="pb-3 text-base font-bold">
                                    吊る・引く荷の重さが、このロープの使用荷重（定格荷重）以内であることを確認してください。
                                </p>
                                <label className="flex min-h-touch items-center gap-4">
                                    <input
                                        type="checkbox"
                                        checked={loadChecked}
                                        onChange={(e) => setLoadChecked(e.target.checked)}
                                    />
                                    <span className="text-xl font-extrabold">荷重に問題がないことを確認しました</span>
                                </label>
                            </fieldset>
                        )}

                        <ConflictAlert conflicts={conflicts} />
                        {ownReservation && conflicts.length === 0 && (
                            <p role="status" className="rounded-xl border-2 border-state-good p-3 text-lg font-bold text-state-good">
                                予約（{ownReservation.label}）を使って持ち出します。
                            </p>
                        )}

                        {mode === 'rent' && (
                            <div>
                                <p className="pb-2 text-lg font-bold">持ち出し場所</p>
                                {/* 既定の持ち出し場所が入っているときは、その旨を明示して確認を促す */}
                                {borrower?.defaultPin && (
                                    <p className="pb-3 text-base text-sub">
                                        マイページで登録した既定の場所を初期値にしています。違う場合は変更してください。
                                    </p>
                                )}
                                <MapPicker
                                    pin={tool.pin}
                                    setPin={(pin) => setTool({ ...tool, pin })}
                                    label="持ち出し場所"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={isConfirmOpen}
                setIsOpen={setIsConfirmOpen}
                text={confirmText}
                yesText={mode === 'rent' ? '借りる' : '予約する'}
                noText="やめる"
                setBoolean={(yes) => yes && submit()}
            />
        </>
    )
}

export default RentModal
