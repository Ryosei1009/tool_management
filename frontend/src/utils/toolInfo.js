import { normalize } from './search'

// 不良ランク。値は backend の tools.defect_rank（ENUM）と一致させる。
// 買い替えの判断に使うので、重いほど目立つ表示にする（DefectRankBadge）。
export const DEFECT_RANKS = [
    { value: 'minor', label: '軽微（使用可）', short: '軽微' },
    { value: 'repair', label: '要修理', short: '要修理' },
    { value: 'replace', label: '要買い替え', short: '要買い替え' },
    // 新しいものを手配済みで、届くのを待っている
    { value: 'waiting', label: '交換待ち', short: '交換待ち' },
]

export const getDefectRank = (rank) => DEFECT_RANKS.find((r) => r.value === rank) ?? null

// 購入日からの経過（「6年4か月」「3か月」「1か月未満」）。years は買い替え目安の判定用。
export const getPurchaseAge = (purchaseDate, now = new Date()) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(purchaseDate ?? '')
    if (!m) return null
    let months = (now.getFullYear() - Number(m[1])) * 12 + (now.getMonth() + 1 - Number(m[2]))
    if (now.getDate() < Number(m[3])) months -= 1
    if (months < 0) return null
    const years = Math.floor(months / 12)
    const rest = months % 12
    const label =
        months === 0
            ? '1か月未満'
            : years === 0
              ? `${rest}か月`
              : rest === 0
                ? `${years}年`
                : `${years}年${rest}か月`
    return { years, months, label }
}

// 「2019年4月1日 購入（6年6か月）」
export const formatPurchase = (purchaseDate) => {
    const age = getPurchaseAge(purchaseDate)
    if (!age) return '未登録'
    const [y, mo, d] = purchaseDate.split('-').map(Number)
    return `${y}年${mo}月${d}日（${age.label}前）`
}

// 大項目（カテゴリ）の一覧。選択肢は取得済みの工具から作る。
export const getCategories = (tools) =>
    [...new Set((tools ?? []).map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))

// 大項目がロープ（ロープ・ワイヤーロープなど）か。backend の utils/search.js と同じ判定。
// 全角/半角・ひらがな/カタカナの違いは区別しない。
export const isRope = (category) => normalize(category).includes('ろーぷ')

// ロープの点検の有効期間（最終点検日からの月数）
export const ROPE_INSPECTION_MONTHS = 3

const formatYmd = (d) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`

// 最終点検日から months か月以内か。
// { ok, label, detail }。点検日が無いものは期限切れと同じ扱い（ok: false）にする。
export const getInspectionStatus = (lastInspectionDate, months = ROPE_INSPECTION_MONTHS, now = new Date()) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lastInspectionDate ?? '')
    if (!m) return { ok: false, label: '点検記録なし', detail: '点検してから使用してください' }

    const last = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    const due = new Date(last.getFullYear(), last.getMonth() + months, last.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days = Math.round((due - today) / 86400000)

    if (days < 0) {
        return {
            ok: false,
            label: `点検期限切れ（${-days} 日超過）`,
            detail: `最終点検 ${formatYmd(last)}・期限 ${formatYmd(due)}`,
        }
    }
    return {
        ok: true,
        label: `点検 ${months}か月以内`,
        detail: `最終点検 ${formatYmd(last)}・期限まで あと ${days} 日`,
    }
}
