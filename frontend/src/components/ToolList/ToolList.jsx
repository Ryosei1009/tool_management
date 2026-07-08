import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { sampleTools } from '../../data/sampleData'
import DetailModal from './DetailModal'

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

// 工具1件分のカード
const ToolCard = ({ tool }) => {
    const {
        id,
        name = '',
        startDate = '',
        endDate = '',
        user = '',
        place = '',
        photoUrl = '',
    } = tool ?? {}
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

    return (
        <>
            <div
                onClick={() => setIsDetailModalOpen(true)}
                className="flex items-center gap-4 rounded-2xl border-main border-2 bg-base px-4 py-3"
            >
                {/* 顔写真 / アイコン */}
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-main bg-base">
                    {photoUrl && (
                        <img src={photoUrl} alt={name || 'アイコン'} className="h-full w-full object-cover" />
                    )}
                </div>

                {/* 名前・期間 */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                        <span className="w-10 text-xs">名前</span>
                        <span className="font-semibold truncate">{name || '○○　○○'}</span>
                    </div>
                    <div className="font-semibold truncate">
                        {startDate || '1月1日'}～{endDate || '1月2日'}
                    </div>
                </div>

                {/* 使用者・使用場所 */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                        <span className="w-16 text-xs">使用者</span>
                        <span className="font-semibold truncate">{user || '○○'}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                        <span className="w-16 text-xs">使用場所</span>
                        <span className="font-semibold truncate">{place || '○○'}</span>
                    </div>
                </div>
            </div>
            <DetailModal
                isOpen={isDetailModalOpen}
                setIsOpen={setIsDetailModalOpen}
            />
        </>
    )
}

const ToolList = ({ tools = sampleTools }) => {
    const [keyword, setKeyword] = useState('')

    const filtered = keyword
        ? tools.filter((t) =>
            [t.name, t.user, t.place].some((v) => (v ?? '').includes(keyword))
        )
        : tools

    return (
        <div className="flex items-start justify-center min-h-screen w-screen bg-base pb-24">
            <div className="w-full max-w-5xl px-6 pt-8">
                <div className="text-6xl font-bold text-center pb-8">
                    工具リスト
                </div>
                <SearchBar keyword={keyword} onChange={setKeyword} />
                <div className="flex flex-col gap-5">
                    {filtered.map((tool, i) => (
                        <ToolCard key={tool.id ?? i} tool={tool} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default ToolList
