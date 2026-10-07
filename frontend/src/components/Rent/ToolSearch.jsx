import React, { useCallback, useState } from 'react'
import SearchBar from '../Util/SearchBar'
import StateBadge from '../Util/StateBadge'
import DefectRankBadge from '../Util/DefectRankBadge'
import CategorySelect from '../Util/CategorySelect'
import { getCategories } from '../../utils/toolInfo'
import { fetchTools, resolveImageUrl } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { matchesKeyword } from '../../utils/search'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'

// 借りる画面 右半分：工具を検索して選ぶ。
// QRリーダーと同様に、選択すると setResult を呼んで貸出入力へ進む。
// 貸出中の工具も予約はできるので選べるようにし、「予約」と文字で示す。
const ToolSearch = ({ setResult }) => {
    const [keyword, setKeyword] = useState('')
    const [category, setCategory] = useState('')
    const load = useCallback(() => fetchTools(), [])
    const { data: tools, loading, error, reload } = useFetch(load)

    const all = tools ?? []
    const filtered = all.filter(
        (t) => (!category || t.category === category) && matchesKeyword(keyword, [t.name, t.id, t.place, t.category])
    )

    return (
        <div className="flex h-full min-h-0 flex-col px-6">
            <SearchBar keyword={keyword} onChange={setKeyword} label="" placeholder="工具名 / ID / 場所 で検索" />
            <div className="mb-4">
                <CategorySelect
                    id="rent-category"
                    categories={getCategories(all)}
                    value={category}
                    onChange={setCategory}
                />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2">
                {loading ? (
                    <Loading />
                ) : error ? (
                    <ErrorMessage message={error} onRetry={reload} />
                ) : filtered.length === 0 ? (
                    <Empty>該当する工具がありません</Empty>
                ) : (
                    filtered.map((tool) => (
                        <button
                            key={tool.id}
                            type="button"
                            onClick={() => setResult(tool.id)}
                            // 枠線の色で貸出状況を示す（貸出中=赤 / 貸出可能=緑）。
                            // 色だけに頼らないよう、右端に「予約 / 選ぶ」の文字も出す。
                            className={`flex w-full items-center gap-4 rounded-2xl border-4 bg-surface px-4 py-3 text-left ${
                                tool.isRented ? 'border-accent' : 'border-available'
                            }`}
                        >
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-line bg-field">
                                {tool.photoUrl && (
                                    <img
                                        src={resolveImageUrl(tool.photoUrl)}
                                        alt=""
                                        aria-hidden="true"
                                        className="h-full w-full object-cover"
                                    />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="truncate text-xl font-extrabold">
                                        {tool.name}</span>
                                    <StateBadge state={tool.state} />
                                    <DefectRankBadge rank={tool.defectRank} />
                                </div>
                                <dl className="mt-1 flex flex-wrap gap-x-4 text-base font-bold">
                                    <div className="flex min-w-0 gap-2">
                                        <dt className="font-medium text-sub">持ち出し場所</dt>
                                        <dd className="truncate">{tool.place ?? '未設定'}</dd>
                                    </div>
                                    {tool.isRented && (
                                        <div className="flex min-w-0 gap-2">
                                            <dt className="font-medium text-sub">返却予定</dt>
                                            <dd className="truncate">{tool.endDate}</dd>
                                        </div>
                                    )}
                                    {(tool.reservations ?? []).length > 0 && (
                                        <div className="flex min-w-0 gap-2">
                                            <dt className="font-medium text-sub">予約</dt>
                                            <dd className="truncate">{tool.reservations.length} 件</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                            <span
                                className={`shrink-0 rounded-full border-2 px-4 py-1 text-base font-extrabold ${
                                    tool.isRented ? 'border-accent text-accent' : 'border-available text-available'
                                }`}
                            >
                                {tool.isRented ? (
                                    <>
                                        貸出中
                                    </>
                                ) : (
                                    '貸出可'
                                )}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

export default ToolSearch
