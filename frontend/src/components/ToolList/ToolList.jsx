import React, { useCallback, useState } from 'react'
import DetailModal from './DetailModal'
import PageTitle from '../Util/PageTitle'
import SearchBar from '../Util/SearchBar'
import StateBadge from '../Util/StateBadge'
import DefectRankBadge from '../Util/DefectRankBadge'
import CategorySelect from '../Util/CategorySelect'
import { fetchTools, resolveImageUrl } from '../../api'
import { matchesKeyword } from '../../utils/search'
import { describeInspection, getCategories, getPurchaseAge, isRope } from '../../utils/toolInfo'
import { useAuth } from '../../auth/AuthContext'
import { isAdmin } from '../../utils/roles'
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
        <div className="min-w-0">
            <label htmlFor="tool-sort" className="block text-base font-bold text-sub">
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
const Label = ({ children }) => <span className="mr-2 text-base font-medium text-sub">{children}</span>

// 点検が期限内かどうか。安全に関わるので、色に加えてアイコンと文字で大きく示す。
//   期限切れ … 赤地に ✕ ／ まもなく … 橙の枠に ▲ ／ 期限内 … 青の枠に ●
const INSPECTION_STYLES = {
    overdue: { className: 'bg-accent text-surface', icon: '✕' },
    soon: { className: 'border-2 border-state-bad text-state-bad', icon: '▲' },
    ok: { className: 'border-2 border-state-good text-state-good', icon: '●' },
}

const InspectionStatus = ({ status }) => {
    const { className, icon } = INSPECTION_STYLES[status.status]
    return (
        <p className={`flex flex-wrap items-center gap-x-4 rounded-xl px-3 py-1 text-lg font-extrabold ${className}`}>
            <span>
                <span aria-hidden="true" className="mr-1">
                    {icon}
                </span>
                {status.label}
            </span>
            <span className={`text-base font-bold ${status.status === 'overdue' ? '' : 'text-sub'}`}>
                {status.detail}
            </span>
        </p>
    )
}

// 点検の状況は、期限切れ・まもなく期限のときは常に出す。
// showInspection … ロープで絞り込んでいるときは、期限内のものにも出す
// showLastInspection … 最終点検日で並び替えているとき、最終点検日を出す
const ToolCard = ({ tool, onSelect, showInspection, showLastInspection }) => {
    const {
        name,
        id,
        category,
        startDate,
        endDate,
        takenAt,
        user,
        place,
        photoUrl,
        state,
        defectRank,
        purchaseDate,
        lastInspectionDate,
        isRented,
        active,
        reservations = [],
    } = tool
    const age = getPurchaseAge(purchaseDate)
    const status = describeInspection(tool)
    const inspection = status && (showInspection || status.status !== 'ok') ? status : null

    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                className={`flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-4 px-4 py-3 text-left ${
                    !active
                        ? 'border-dashed border-sub bg-field'
                        : isRented
                          ? 'border-accent bg-surface'
                          : 'border-available bg-surface'
                }`}
            >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-line bg-field">
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
                        <DefectRankBadge rank={defectRank} />
                    </div>
                    <div className="flex flex-wrap gap-x-8 text-lg font-bold">
                        <span>
                            <Label>ID</Label>
                            {id}
                        </span>
                        {category && (
                            <span>
                                <Label>大項目</Label>
                                {category}
                            </span>
                        )}
                        <span>
                            <Label>持ち出し場所</Label>
                            {place ?? '未設定'}
                        </span>
                        <span>
                            <Label>購入</Label>
                            {age ? `${age.label}前` : '未登録'}
                        </span>
                        {/* 点検の状況を出しているときは、そこに最終点検日も入っているので重ねて出さない */}
                        {showLastInspection && !inspection && (
                            <span>
                                <Label>最終点検日</Label>
                                {lastInspectionDate ? lastInspectionDate.replace(/-/g, '/') : '未点検'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="min-w-52 flex-1">
                    {!active ? (
                        <p className="text-lg font-extrabold text-sub">無効化済み（貸出・予約はできません）</p>
                    ) : isRented ? (
                        <>
                            <p className="text-lg font-extrabold text-accent">貸出中</p>
                            <div className="flex flex-wrap gap-x-6 text-lg font-bold">
                                <span>
                                    <Label>使用者</Label>
                                    {user}
                                </span>
                                <span>
                                    <Label>持出</Label>
                                    {takenAt || startDate}
                                </span>
                                <span>
                                    <Label>返却予定</Label>
                                    {endDate}
                                </span>
                            </div>
                        </>
                    ) : (
                        <p className="text-lg font-extrabold text-available">貸出可能</p>
                    )}
                    {reservations.length > 0 && (
                        <p className="text-base font-bold">
                            <Label>次の予約</Label>
                            {reservations[0].label}
                            {reservations.length > 1 && (
                                <span className="ml-2 text-sub">ほか {reservations.length - 1} 件</span>
                            )}
                        </p>
                    )}
                </div>

                {/* 安全に関わるので、カードの幅いっぱいに出して見落とさないようにする */}
                {inspection && (
                    <div className="w-full">
                        <InspectionStatus status={inspection} />
                    </div>
                )}
            </button>
        </li>
    )
}

const ToolList = () => {
    const [keyword, setKeyword] = useState('')
    const [category, setCategory] = useState('')
    const [selectedId, setSelectedId] = useState(null)
    const [sort, setSort] = useState(loadSort)
    const { user } = useAuth()
    const admin = isAdmin(user)
    // 無効化した工具も表示する（管理者のみ）
    const [showInactive, setShowInactive] = useState(false)
    const load = useCallback(() => fetchTools({ includeInactive: admin && showInactive }), [admin, showInactive])
    const { data: tools, loading, error, reload } = useFetch(load)

    const changeSort = (next) => {
        setSort(next)
        saveSort(next)
    }

    // 検索はサーバー側にもあるが、入力のたびに叩かず取得済みの一覧から絞る。
    // 全角/半角・ひらがな/カタカナの違いは区別しない。
    const all = tools ?? []
    const categories = getCategories(all)
    const counts = Object.fromEntries(categories.map((c) => [c, all.filter((t) => t.category === c).length]))
    const filtered = sortTools(
        all.filter(
            (t) =>
                (!category || t.category === category) &&
                matchesKeyword(keyword, [t.name, t.id, t.user, t.place, t.category])
        ),
        sort
    )
    const isFiltered = Boolean(keyword || category)
    // ロープで絞り込んでいるときは、期限内のものも含めて点検の状況を確認できるようにする
    const ropeMode = Boolean(category) && isRope(category)
    const expiredCount = ropeMode ? filtered.filter((t) => t.inspection?.status === 'overdue').length : 0

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-6">
                <PageTitle
                    en="TOOLS"
                    description=""
                >
                    工具リスト
                </PageTitle>

                <p className="mb-4 text-xl font-extrabold">
                    {filtered.length} 件
                    {isFiltered && (
                        <span className="ml-2 text-base font-bold text-sub">
                            （全 {all.length} 件中）
                        </span>
                    )}
                </p>

                <SearchBar
                    keyword={keyword}
                    onChange={setKeyword}
                    label="工具を検索"
                    placeholder="工具名 / ID / 使用者 / 場所 で検索"
                />

                <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <CategorySelect
                        categories={categories}
                        value={category}
                        onChange={setCategory}
                        counts={counts}
                    />
                    <SortControl sort={sort} onChange={changeSort} />
                </div>

                {admin && (
                    <label className="mb-4 flex min-h-touch items-center gap-4">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        <span className="text-lg font-bold">無効化した工具も表示する</span>
                    </label>
                )}

                {ropeMode && !loading && !error && filtered.length > 0 && (
                    <p
                        role="status"
                        className={`mb-4 rounded-xl px-4 py-2 text-lg font-extrabold ${
                            expiredCount > 0 ? 'bg-accent text-surface' : 'border-2 border-state-good text-state-good'
                        }`}
                    >
                        <span aria-hidden="true" className="mr-2">
                            {expiredCount > 0 ? '✕' : '●'}
                        </span>
                        {expiredCount > 0
                            ? `点検期限が切れているロープが ${expiredCount} 件あります。使用せずに点検してください。`
                            : 'すべてのロープが点検の期限内です。'}
                    </p>
                )}

                {loading && !tools ? (
                    <Loading />
                ) : error && !tools ? (
                    <ErrorMessage message={error} onRetry={reload} />
                ) : filtered.length === 0 ? (
                    <Empty>該当する工具がありません</Empty>
                ) : (
                    <ul className="mb-4 flex flex-col gap-3">
                        {filtered.map((tool) => (
                            <ToolCard
                                key={tool.id}
                                tool={tool}
                                showInspection={ropeMode}
                                showLastInspection={sort.by === 'lastInspectionDate'}
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
                categories={categories}
                onUpdated={reload}
            />
        </div>
    )
}

export default ToolList
