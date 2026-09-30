import React, { useCallback, useState } from 'react'
import SearchBar from '../Util/SearchBar'
import StateBadge from '../Util/StateBadge'
import { fetchTools, resolveImageUrl } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'

// 借りる画面 右半分：工具を検索して選ぶ。
// QRリーダーと同様に、選択すると setResult を呼んで貸出入力へ進む。
// 貸出中の工具は選べないので、押せないことを文字でも示す。
const ToolSearch = ({ setResult }) => {
    const [keyword, setKeyword] = useState('')
    const load = useCallback(() => fetchTools(), [])
    const { data: tools, loading, error, reload } = useFetch(load)

    const filtered = keyword
        ? (tools ?? []).filter((t) =>
              [t.name, t.id, t.place].some((v) => (v ?? '').toString().includes(keyword))
          )
        : (tools ?? [])

    return (
        <div className="flex h-full min-h-0 flex-col px-6">
            <SearchBar
                keyword={keyword}
                onChange={setKeyword}
                label=""
                placeholder="工具名 / ID / 場所 で検索"
            />

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2 pr-2">
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
                            disabled={tool.isRented}
                            // 枠線の色で貸出状況を示す（貸出中=赤 / 貸出可能=緑）。
                            // 色だけに頼らないよう、右端に「貸出中 / 選ぶ」の文字も出す。
                            className={`flex w-full items-center gap-4 rounded-2xl border-4 bg-surface px-4 py-3 text-left ${
                                tool.isRented ? 'border-accent opacity-60' : 'border-available'
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
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-xl font-extrabold">
                                        {tool.name}
                                    </span>
                                    <span className="shrink-0">
                                        <StateBadge state={tool.state} />
                                    </span>
                                </div>
                                <dl className="mt-1 flex flex-wrap gap-x-4 text-base font-bold">
                                    <div className="flex min-w-0 gap-2">
                                        <dt className="font-medium text-sub">ID</dt>
                                        <dd className="truncate">{tool.id}</dd>
                                    </div>
                                    <div className="flex min-w-0 gap-2">
                                        <dt className="font-medium text-sub">場所</dt>
                                        <dd className="truncate">{tool.place ?? '未設定'}</dd>
                                    </div>
                                </dl>
                            </div>
                            <span
                                className={`shrink-0 rounded-full border-2 px-4 py-1 text-base font-extrabold ${
                                    tool.isRented
                                        ? 'border-accent text-accent'
                                        : 'border-available text-available'
                                }`}
                            >
                                {tool.isRented ? '貸出中' : '選ぶ'}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

export default ToolSearch
