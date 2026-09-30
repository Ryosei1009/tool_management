import React, { useCallback, useState } from 'react'
import DetailModal from './DetailModal'
import PageTitle from '../Util/PageTitle'
import SearchBar from '../Util/SearchBar'
import StateBadge from '../Util/StateBadge'
import { fetchTools, resolveImageUrl } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'
import { DEFAULT_SORT, SORT_OPTIONS, getSortOption, sortTools } from '../../utils/toolSort'

// 並び替えの選択は端末ごとに覚えておく（保存できない環境では既定の並びで動く）
const SORT_STORAGE_KEY = 'tool_management_tool_sort'

const loadSort = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(SORT_STORAGE_KEY))
        if (SORT_OPTIONS.some((o) => o.value === saved?.by)) {
            return { by: saved.by, desc: Boolean(saved.desc) }
        }
    } catch {
        // 読めなければ既定の並びにする
    }
    return DEFAULT_SORT
}

const saveSort = (sort) => {
    try {
        localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort))
    } catch {
        // 保存できなくても並び替え自体は動くので無視する
    }
}

// 並び替えの項目と向き。
// 手袋でも操作できるよう、項目はネイティブの選択欄、向きは文字付きの大きなボタンにする。
const SortControl = ({ sort, onChange }) => {
    const [ascLabel, descLabel] = getSortOption(sort.by).directions
    const current = sort.desc ? descLabel : ascLabel

    return (
        <div className="mb-6">
            <label htmlFor="tool-sort" className="mb-2 block text-base font-bold text-sub">
                並び替え
            </label>
            <div className="flex items-center gap-3">
                <select
                    id="tool-sort"
                    value={sort.by}
                    onChange={(e) => onChange({ ...sort, by: e.target.value })}
                    className="min-h-touch min-w-0 flex-1 rounded-xl border-2 border-ink bg-surface px-4 text-lg font-bold"
                >
                    {SORT_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => onChange({ ...sort, desc: !sort.desc })}
                    aria-label={`並びの向き：${current}（押すと切り替え）`}
                    className="min-h-touch shrink-0 rounded-xl border-2 border-ink px-5 text-lg font-extrabold"
                >
                    <span aria-hidden="true">
                        {sort.desc ? '↓' : '↑'} {current}
                    </span>
                </button>
            </div>
        </div>
    )
}

// 工具1件分のカード。
// カード全体がボタンなので、手袋でも狙いやすい。
// 貸出状況は枠線の色（貸出中=赤 / 貸出可能=緑）で離れていても分かるようにし、
// 色だけに頼らないよう「貸出中 / 貸出可能」の文字も必ず併記する。
const ToolCard = ({ tool, onSelect }) => {
    const { name, id, startDate, endDate, user, place, photoUrl, state, isRented } = tool

    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                className={`flex w-full flex-wrap items-center gap-5 rounded-2xl border-4 bg-surface px-5 py-4 text-left ${
                    isRented ? 'border-accent' : 'border-available'
                }`}
            >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-line bg-field">
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
                    <div className="flex flex-wrap gap-x-8 text-lg font-bold">
                        <span>
                            <span className="mr-2 text-base font-medium text-sub">ID</span>
                            {id}
                        </span>
                        <span>
                            <span className="mr-2 text-base font-medium text-sub">置き場所</span>
                            {place ?? '未設定'}
                        </span>
                    </div>
                </div>

                <div className="min-w-52 flex-1">
                    {isRented ? (
                        <>
                            <p className="text-lg font-extrabold text-accent">貸出中</p>
                            <div className="text-lg font-bold">
                                <span className="mr-2 text-base font-medium text-sub">使用者</span>
                                {user}
                            </div>
                            <div className="text-lg font-bold">
                                <span className="mr-2 text-base font-medium text-sub">期間</span>
                                {startDate} 〜 {endDate}
                            </div>
                        </>
                    ) : (
                        <p className="text-lg font-extrabold text-available">貸出可能</p>
                    )}
                </div>
            </button>
        </li>
    )
}

const ToolList = () => {
    const [keyword, setKeyword] = useState('')
    const [selectedId, setSelectedId] = useState(null)
    const [sort, setSort] = useState(loadSort)
    const load = useCallback(() => fetchTools(), [])
    const { data: tools, loading, error, reload } = useFetch(load)

    const changeSort = (next) => {
        setSort(next)
        saveSort(next)
    }

    // 検索はサーバー側にもあるが、入力のたびに叩かず取得済みの一覧から絞る
    const filtered = sortTools(
        keyword
            ? (tools ?? []).filter((t) =>
                  [t.name, t.id, t.user, t.place, t.category].some((v) => (v ?? '').includes(keyword))
              )
            : (tools ?? []),
        sort
    )

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-8">
                <PageTitle
                    en="TOOLS"
                    description="工具をタップすると、状態・点検日・使用履歴を確認できます。"
                >
                    工具リスト
                </PageTitle>

                <p className="mb-6 text-xl font-extrabold">
                    {filtered.length} 件
                    {keyword && (
                        <span className="ml-2 text-base font-bold text-sub">
                            （全 {(tools ?? []).length} 件中）
                        </span>
                    )}
                </p>

                <SearchBar
                    keyword={keyword}
                    onChange={setKeyword}
                    label="工具を検索"
                    placeholder="工具名 / ID / 使用者 で検索"
                />

                <SortControl sort={sort} onChange={changeSort} />

                {loading ? (
                    <Loading />
                ) : error ? (
                    <ErrorMessage message={error} onRetry={reload} />
                ) : filtered.length === 0 ? (
                    <Empty>該当する工具がありません</Empty>
                ) : (
                    <ul className="mb-4 flex flex-col gap-5">
                        {filtered.map((tool) => (
                            <ToolCard
                                key={tool.id}
                                tool={tool}
                                onSelect={() => setSelectedId(tool.id)}
                            />
                        ))}
                    </ul>
                )}
            </div>

            <DetailModal
                isOpen={selectedId !== null}
                setIsOpen={(open) => !open && setSelectedId(null)}
                toolId={selectedId}
                onUpdated={() => {
                    setSelectedId(null)
                    reload()
                }}
            />
        </div>
    )
}

export default ToolList
