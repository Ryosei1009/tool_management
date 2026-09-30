// 工具リストの並び替え。
// 各項目の compare は「昇順」の比較で、降順は結果を反転して使う。
// directions は向き切り替えボタンの文言（[昇順, 降順]）。項目ごとに意味が伝わる言葉にする。
// 値が無いもの（貸出していない工具の返却日など）は、向きに関係なく常に末尾へ回す。

const collator = new Intl.Collator('ja', { numeric: true })
const text = (a, b) => collator.compare(a ?? '', b ?? '')

// 状態は「問題があるもの」から見たいので 破損 → 不良 → 良好 を昇順とする
const STATE_ORDER = { damaged: 0, bad: 1, good: 2 }

const TEXT = ['昇順', '降順']
const DATE = ['古い順', '新しい順']

export const SORT_OPTIONS = [
    { value: 'id', label: 'ID', directions: TEXT, compare: (a, b) => text(a.id, b.id) },
    { value: 'name', label: '工具名', directions: TEXT, compare: (a, b) => text(a.name, b.name) },
    { value: 'category', label: '種類', directions: TEXT, compare: (a, b) => text(a.category, b.category) },
    {
        value: 'place',
        label: '置き場所',
        directions: TEXT,
        key: (t) => t.place,
        compare: (a, b) => text(a.place, b.place),
    },
    {
        value: 'state',
        label: '状態',
        directions: ['破損・不良が先', '良好が先'],
        compare: (a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9),
    },
    {
        value: 'rented',
        label: '貸出状況',
        directions: ['貸出中が先', '貸出可能が先'],
        compare: (a, b) => Number(b.isRented) - Number(a.isRented),
    },
    {
        value: 'rentEnd',
        label: '返却予定日',
        directions: ['早い順', '遅い順'],
        key: (t) => t.rentEnd,
        compare: (a, b) => text(a.rentEnd, b.rentEnd),
    },
    {
        value: 'user',
        label: '使用者',
        directions: TEXT,
        key: (t) => t.user,
        compare: (a, b) => text(a.user, b.user),
    },
    {
        value: 'lastInspectionDate',
        label: '最終点検日',
        directions: DATE,
        key: (t) => t.lastInspectionDate,
        compare: (a, b) => text(a.lastInspectionDate, b.lastInspectionDate),
    },
]

export const getSortOption = (by) => SORT_OPTIONS.find((o) => o.value === by) ?? SORT_OPTIONS[0]

export const DEFAULT_SORT = { by: 'id', desc: false }

export const sortTools = (tools, { by, desc }) => {
    const option = getSortOption(by)
    const hasValue = (t) => !option.key || Boolean(option.key(t))

    return [...tools].sort((a, b) => {
        const aHas = hasValue(a)
        const bHas = hasValue(b)
        if (aHas !== bHas) return aHas ? -1 : 1

        const result = aHas ? option.compare(a, b) : 0
        if (result !== 0) return desc ? -result : result
        // 同じ値どうしは常に ID 順にして、並びが毎回変わらないようにする
        return text(a.id, b.id)
    })
}
