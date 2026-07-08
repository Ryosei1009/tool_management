import React, { useEffect, useState } from 'react'
import { sampleRentItems } from '../../data/sampleData'
import ConfirmModal from '../Util/ConfirmModal'
import RenewModal from './RenewModal'

// 検索バー + フィルタ（借りる画面のヘッダーに合わせた配色）
const SearchBar = ({ keyword, onChange }) => (
    <div className="flex items-center gap-3 mb-6">
        <div className="flex flex-1 items-center rounded-lg border-main border-2 bg-base px-4 py-2">
            <input
                type="text"
                value={keyword}
                onChange={(e) => onChange(e.target.value)}
                className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
            />
            {/* 虫眼鏡アイコン */}
            <svg
                className="h-6 w-6 shrink-0 text-main"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
            >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
            </svg>
        </div>
        <button
            type="button"
            aria-label="絞り込み"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-main border-2 bg-base"
        >
            <svg className="h-6 w-6 text-main" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 4h18l-7 8v7l-4 2v-9L3 4z" />
            </svg>
        </button>
    </div>
)

// 借りている工具1件分のカード
const RentCard = ({ item, onReturn, onRenew }) => {
    const { name = '', photoUrl = '', startDate = '', endDate = '', place = '' } = item ?? {}

    return (
        <div className="flex items-center gap-4 rounded-2xl border-main border-2 bg-base px-4 py-3">
            {/* 顔写真 / アイコン */}
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-main bg-base">
                {photoUrl && (
                    <img src={photoUrl} alt={name || 'アイコン'} className="h-full w-full object-cover" />
                )}
            </div>

            {/* 情報 */}
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                    <span className="w-10 text-xs">名前</span>
                    <span className="font-semibold truncate">{name || '～＿～'}</span>
                </div>
                <div className="font-semibold truncate">
                    {startDate || '○月○日'} <span className="text-main">～</span> {endDate || '○月○日'}
                </div>
                <div className="flex items-baseline gap-3">
                    <span className="w-10 text-xs">場所</span>
                    <span className="font-semibold truncate">{place || '～～'}</span>
                </div>
            </div>

            {/* 操作ボタン */}
            <button
                type="button"
                onClick={onReturn}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent text-base font-extrabold"
            >
                返す
            </button>
            <button
                type="button"
                onClick={onRenew}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-main text-base font-extrabold"
            >
                更新
            </button>
        </div>
    )
}

const RentList = ({ items = sampleRentItems, onReturn, onRenew }) => {
    const [keyword, setKeyword] = useState('')
    const [isReturnConfirmOpen, setIsReturnConfirmOpen] = useState(false)
    const [isReturnConfirmed, setIsReturnConfirmed] = useState(false)
    useEffect(() => {
        if (isReturnConfirmed) {
            console.log('返す処理を実行')
            window.location.reload()
        }
    }, [isReturnConfirmed])
    const [isRenewModalOpen, setIsRenewModalOpen] = useState(false)

    const filtered = keyword
        ? items.filter((it) =>
            [it.name, it.place].some((v) => (v ?? '').includes(keyword))
        )
        : items

    return (
        <>
            <div className="flex items-start justify-center min-h-screen w-screen bg-base pb-24">
                <div className="w-full max-w-5xl px-6 pt-8">
                    <SearchBar keyword={keyword} onChange={setKeyword} />
                    <div className="flex flex-col gap-5">
                        {filtered.map((item, i) => (
                            <RentCard
                                key={item.id ?? i}
                                item={item}
                                onReturn={() => setIsReturnConfirmOpen(true)}
                                onRenew={() => setIsRenewModalOpen(true)}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <ConfirmModal
                isOpen={isReturnConfirmOpen}
                setIsOpen={setIsReturnConfirmOpen}
                text="返却しますか？"
                yesText="はい"
                noText="いいえ"
                setBoolean={setIsReturnConfirmed}
                borderColor="border-accent"
            />
            <RenewModal
                isOpen={isRenewModalOpen}
                setIsOpen={setIsRenewModalOpen}
            />
        </>
    )
}

export default RentList
