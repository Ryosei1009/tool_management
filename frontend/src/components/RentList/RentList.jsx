import React, { useCallback, useState } from 'react'
import ConfirmModal from '../Util/ConfirmModal'
import RenewModal from './RenewModal'
import ReturnModal from './ReturnModal'
import PageTitle from '../Util/PageTitle'
import SearchBar from '../Util/SearchBar'
import Button from '../Util/Button'
import StateBadge from '../Util/StateBadge'
import DefectRankBadge from '../Util/DefectRankBadge'
import Segmented from '../Util/Segmented'
import { cancelReservation, fetchMyRentals, resolveImageUrl, startRental } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { useAuth } from '../../auth/AuthContext'
import { matchesKeyword } from '../../utils/search'
import { currentSlot, getDueInfo, slotKey } from '../../utils/period'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'

const Label = ({ children }) => <span className="mr-2 text-base font-medium text-sub">{children}</span>

// 借りている工具・予約している工具1件分のカード。
// 返却予定が近い / 過ぎている貸出は、色だけでなく「◯日超過」「あと◯日」という文字でも伝える。
const RentCard = ({ item, showUser, disabled, onReturn, onRenew, onStart, onCancel }) => {
    const { name, photoUrl, takenAt, takenBy, startDate, endDate, place, state, defectRank, rentEnd, rentEndPeriod } =
        item
    const reserved = item.rentalStatus === 'reserved'
    const due = reserved ? null : getDueInfo(rentEnd, rentEndPeriod)
    // 予約の開始時刻が来ているか（来ていなければ「持ち出す」は押せるが、開始前であることを示す）
    const now = currentSlot()
    const started = reserved && slotKey(item.rentStart, item.rentStartPeriod) <= slotKey(now.date, now.period)

    return (
        <li
            className={`rounded-2xl bg-surface px-4 py-3 ${
                reserved ? 'border-2 border-dashed border-steel' : 'border-2 border-ink'
            }`}
        >
            {due && (
                <p
                    className={`mb-3 flex items-center gap-2 rounded-xl px-4 py-2 text-lg font-extrabold ${
                        due.urgent ? 'bg-accent text-surface' : 'border-2 border-state-bad text-state-bad'
                    }`}
                >
                    <span aria-hidden="true">{due.urgent ? '✕' : '▲'}</span>
                    {due.label}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-field">
                    {photoUrl && (
                        <img
                            src={resolveImageUrl(photoUrl)}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover"
                        />
                    )}
                </div>

                <div className="min-w-52 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                        {reserved && (
                            <span className="rounded-full bg-steel px-3 py-1 text-base font-extrabold text-surface">
                                予約
                            </span>
                        )}
                        <span className="text-2xl font-extrabold">{name}</span>
                        <StateBadge state={state} />
                        <DefectRankBadge rank={defectRank} />
                    </div>
                    {showUser && (
                        <div className="text-lg font-bold">
                            <Label>借りる人</Label>
                            {item.user}
                        </div>
                    )}
                    {reserved ? (
                        <div className="text-lg font-bold">
                            <Label>予約期間</Label>
                            {startDate} 〜 {endDate}
                            {started && <span className="ml-2 text-base text-state-good">（持ち出せます）</span>}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-x-6">
                            <div className="text-lg font-bold">
                                <Label>持出</Label>
                                {takenAt || startDate}
                                {takenBy && takenBy !== item.user && (
                                    <span className="ml-2 text-base text-sub">（代理：{takenBy}）</span>
                                )}
                            </div>
                            <div className="text-lg font-bold">
                                <Label>返却予定</Label>
                                {endDate}
                            </div>
                            <div className="text-lg font-bold">
                                <Label>持ち出し場所</Label>
                                {place ?? '未設定'}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-3">
                    {reserved ? (
                        <>
                            <Button onClick={onStart} disabled={disabled}>
                                持ち出す
                            </Button>
                            <Button variant="secondary" onClick={onRenew} disabled={disabled}>
                                変更
                            </Button>
                            <Button variant="secondary" onClick={onCancel} disabled={disabled}>
                                取り消す
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="danger" onClick={onReturn} disabled={disabled}>
                                返す
                            </Button>
                            <Button variant="secondary" onClick={onRenew} disabled={disabled}>
                                期間を更新
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </li>
    )
}

const SCOPES = [
    { value: 'mine', label: '自分' },
    { value: 'team', label: '班のメンバー' },
]

const RentList = () => {
    const { user } = useAuth()
    const [keyword, setKeyword] = useState('')
    // 同じ班のメンバーの分は代理で返却・延長できる
    const [scope, setScope] = useState('mine')
    const load = useCallback(() => fetchMyRentals(scope), [scope])
    const { data, loading, error, reload } = useFetch(load)
    const items = scope === 'team' ? (data ?? []).filter((it) => it.userId !== user?.id) : (data ?? [])

    // 操作対象の1件
    const [selected, setSelected] = useState(null)
    const [modal, setModal] = useState(null) // 'return' | 'renew' | 'start' | 'cancel'
    const [actionError, setActionError] = useState('')
    const [message, setMessage] = useState('')
    // リクエスト中は次の操作を受け付けない（連打・多重送信の防止）
    const [busy, setBusy] = useState(false)

    const open = (item, kind) => {
        if (busy) return
        setSelected(item)
        setModal(kind)
        setActionError('')
        setMessage('')
    }
    const closeModal = (isOpen) => !isOpen && setModal(null)

    const runConfirmed = (action, success) => {
        const target = selected
        setModal(null)
        if (!target || busy) return
        setBusy(true)
        setActionError('')
        setMessage('')
        action(target)
            .then(() => {
                setMessage(success(target))
                reload()
            })
            .catch((err) => setActionError(err.message))
            .finally(() => setBusy(false))
    }

    const filtered = items.filter((it) => matchesKeyword(keyword, [it.name, it.place, it.id, it.user]))
    const rentingCount = filtered.filter((it) => it.rentalStatus === 'renting').length
    const reservedCount = filtered.length - rentingCount

    return (
        <>
            <div className="flex w-full items-start justify-center bg-surface pb-nav">
                <div className="w-full max-w-5xl px-6 pt-6">
                    <PageTitle
                        en="MY RENTALS"
                        description=""
                    >
                        借りているもの
                    </PageTitle>

                    {user?.team && (
                        <div className="mb-4">
                            <Segmented
                                label="表示する人"
                                options={SCOPES}
                                value={scope}
                                onChange={(v) => {
                                    setScope(v)
                                    setMessage('')
                                    setActionError('')
                                }}
                                size="lg"
                            />
                            {scope === 'team' && (
                                <p className="pt-2 text-base text-sub">
                                    同じ班（{user.team}）のメンバーの代わりに返却・延長できます。
                                </p>
                            )}
                        </div>
                    )}

                    <p className="mb-4 text-xl font-extrabold">
                        貸出中 {rentingCount} 件
                        <span className="ml-4">予約 {reservedCount} 件</span>
                        {keyword && (
                            <span className="ml-2 text-base font-bold text-sub">（全 {items.length} 件中）</span>
                        )}
                    </p>

                    <SearchBar
                        keyword={keyword}
                        onChange={setKeyword}
                        label="借りている工具を検索"
                        placeholder={scope === 'team' ? '工具名 / 場所 / 名前 で検索' : '工具名 / 場所 で検索'}
                    />

                    {message && (
                        <p role="status" className="pb-4 text-lg font-bold text-state-good">
                            {message}
                        </p>
                    )}
                    {actionError && (
                        <p role="alert" className="whitespace-pre-line pb-4 text-lg font-bold text-accent">
                            ✕ {actionError}
                        </p>
                    )}

                    {loading ? (
                        <Loading />
                    ) : error ? (
                        <ErrorMessage message={error} onRetry={reload} />
                    ) : filtered.length === 0 ? (
                        <Empty>
                            {scope === 'team' ? '班のメンバーが借りている工具はありません' : '借りている工具はありません'}
                        </Empty>
                    ) : (
                        <ul className="flex flex-col gap-3">
                            {filtered.map((item) => (
                                <RentCard
                                    key={item.rentalId}
                                    item={item}
                                    showUser={scope === 'team'}
                                    disabled={busy}
                                    onReturn={() => open(item, 'return')}
                                    onRenew={() => open(item, 'renew')}
                                    onStart={() => open(item, 'start')}
                                    onCancel={() => open(item, 'cancel')}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <ReturnModal
                key={selected?.rentalId}
                isOpen={modal === 'return'}
                setIsOpen={closeModal}
                rental={selected}
                onReturned={(r) => {
                    setMessage(`${r.name} を返却しました。`)
                    reload()
                }}
            />

            <RenewModal
                isOpen={modal === 'renew'}
                setIsOpen={closeModal}
                rental={selected}
                onChanged={() => {
                    setMessage('更新しました。')
                    reload()
                }}
            />

            <ConfirmModal
                isOpen={modal === 'start'}
                setIsOpen={closeModal}
                text={`${selected?.name ?? ''} を持ち出しますか？`}
                yesText="持ち出す"
                noText="やめる"
                setBoolean={(yes) =>
                    yes &&
                    runConfirmed(
                        (t) => startRental({ rentalId: t.rentalId }),
                        (t) => `${t.name} を持ち出しました。`
                    )
                }
            />

            <ConfirmModal
                isOpen={modal === 'cancel'}
                setIsOpen={closeModal}
                text={`${selected?.name ?? ''} の予約を取り消しますか？`}
                yesText="取り消す"
                noText="やめる"
                borderColor="border-accent"
                danger
                setBoolean={(yes) =>
                    yes &&
                    runConfirmed(
                        (t) => cancelReservation(t.rentalId),
                        (t) => `${t.name} の予約を取り消しました。`
                    )
                }
            />
        </>
    )
}

export default RentList
