import React, { useCallback, useEffect, useState } from 'react'
import ConfirmModal from '../Util/ConfirmModal'
import RenewModal from './RenewModal'
import PageTitle from '../Util/PageTitle'
import SearchBar from '../Util/SearchBar'
import Button from '../Util/Button'
import StateBadge from '../Util/StateBadge'
import { fetchMyRentals, resolveImageUrl, returnRental } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'

// 返却予定日が近い / 過ぎている貸出は目立たせる。
// 色だけでなく「◯日超過」「あと◯日」という文字でも伝える。
const getDueInfo = (endDate) => {
    if (!endDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(endDate)
    due.setHours(0, 0, 0, 0)
    if (Number.isNaN(due.getTime())) return null
    const days = Math.round((due - today) / 86400000)

    if (days < 0) return { label: `返却期限を ${-days} 日過ぎています`, urgent: true }
    if (days === 0) return { label: '今日が返却期限です', urgent: true }
    if (days <= 3) return { label: `返却期限まで あと ${days} 日`, urgent: false }
    return null
}

// 借りている工具1件分のカード
const RentCard = ({ item, onReturn, onRenew, disabled }) => {
    const { name, photoUrl, startDate, endDate, place, state, rentEnd } = item
    const due = getDueInfo(rentEnd)

    return (
        <li className="rounded-2xl border-2 border-ink bg-surface px-5 py-4">
            {due && (
                <p
                    className={`mb-3 flex items-center gap-2 rounded-xl px-4 py-2 text-lg font-extrabold ${
                        due.urgent
                            ? 'bg-accent text-surface'
                            : 'border-2 border-state-bad text-state-bad'
                    }`}
                >
                    <span aria-hidden="true">{due.urgent ? '✕' : '▲'}</span>
                    {due.label}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-5">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-field">
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
                        <span className="text-2xl font-extrabold">{name}</span>
                        <StateBadge state={state} />
                    </div>
                    <div className="text-lg font-bold">
                        <span className="mr-2 text-base font-medium text-sub">期間</span>
                        {startDate} 〜 {endDate}
                    </div>
                    <div className="text-lg font-bold">
                        <span className="mr-2 text-base font-medium text-sub">置き場所</span>
                        {place ?? '未設定'}
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-3">
                    <Button variant="danger" onClick={onReturn} disabled={disabled}>
                        返す
                    </Button>
                    <Button variant="secondary" onClick={onRenew} disabled={disabled}>
                        期間を更新
                    </Button>
                </div>
            </div>
        </li>
    )
}

const RentList = () => {
    const [keyword, setKeyword] = useState('')
    const load = useCallback(() => fetchMyRentals(), [])
    const { data: items, loading, error, reload } = useFetch(load)

    // 操作対象の1件（返す / 更新のどちらもこれを見る）
    const [selected, setSelected] = useState(null)
    const [isReturnConfirmOpen, setIsReturnConfirmOpen] = useState(false)
    const [isReturnConfirmed, setIsReturnConfirmed] = useState(false)
    const [isRenewModalOpen, setIsRenewModalOpen] = useState(false)
    const [actionError, setActionError] = useState('')
    const [message, setMessage] = useState('')
    // 返却リクエスト中は次の操作を受け付けない（連打・多重送信の防止）
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!isReturnConfirmed) return
        const target = selected
        // 押した直後に確認モーダルを閉じ、フラグを倒してから送る
        setIsReturnConfirmed(false)
        setIsReturnConfirmOpen(false)
        if (!target || busy) return
        setBusy(true)
        setActionError('')
        setMessage('')
        returnRental({ rentalId: target.rentalId })
            .then(() => {
                setSelected(null)
                setMessage(`${target.name} を返却しました。`)
                reload()
            })
            .catch((err) => setActionError(err.message))
            .finally(() => setBusy(false))
    }, [isReturnConfirmed, selected, busy, reload])

    const filtered = keyword
        ? (items ?? []).filter((it) =>
              [it.name, it.place].some((v) => (v ?? '').includes(keyword))
          )
        : (items ?? [])

    return (
        <>
            <div className="flex w-full items-start justify-center bg-surface pb-nav">
                <div className="w-full max-w-5xl px-6 pt-8">
                    <PageTitle
                        en="MY RENTALS"
                        description="返却するか、返却予定日を延ばすことができます。"
                    >
                        借りているもの
                    </PageTitle>

                    <p className="mb-6 text-xl font-extrabold">
                        {filtered.length} 件
                        {keyword && (
                            <span className="ml-2 text-base font-bold text-sub">
                                （全 {(items ?? []).length} 件中）
                            </span>
                        )}
                    </p>

                    <SearchBar
                        keyword={keyword}
                        onChange={setKeyword}
                        label="借りている工具を検索"
                        placeholder="工具名 / 場所 で検索"
                    />

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

                    {loading ? (
                        <Loading />
                    ) : error ? (
                        <ErrorMessage message={error} onRetry={reload} />
                    ) : filtered.length === 0 ? (
                        <Empty>借りている工具はありません</Empty>
                    ) : (
                        <ul className="flex flex-col gap-5">
                            {filtered.map((item) => (
                                <RentCard
                                    key={item.rentalId}
                                    item={item}
                                    disabled={busy}
                                    onReturn={() => {
                                        if (busy) return
                                        setSelected(item)
                                        setIsReturnConfirmOpen(true)
                                    }}
                                    onRenew={() => {
                                        if (busy) return
                                        setSelected(item)
                                        setIsRenewModalOpen(true)
                                    }}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={isReturnConfirmOpen}
                setIsOpen={setIsReturnConfirmOpen}
                text={`${selected?.name ?? ''} を返却しますか？`}
                yesText="返却する"
                noText="やめる"
                setBoolean={setIsReturnConfirmed}
                borderColor="border-accent"
                danger
            />

            <RenewModal
                isOpen={isRenewModalOpen}
                setIsOpen={setIsRenewModalOpen}
                rental={selected}
                onChanged={() => {
                    setMessage('更新しました。')
                    reload()
                }}
            />
        </>
    )
}

export default RentList
