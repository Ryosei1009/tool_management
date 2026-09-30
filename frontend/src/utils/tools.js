// 貸出のデフォルト期間（日数）
const DEFAULT_RENT_DAYS = 7

const formatDate = (d) =>
    d
        .toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
        .replace(/\//g, '-')

// 貸出期間の初期値（本日 〜 DEFAULT_RENT_DAYS 日後）
export const defaultRentPeriod = () => {
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + DEFAULT_RENT_DAYS)
    return { start: formatDate(start), end: formatDate(end) }
}

// 該当する工具が見つからなかったときに貸出モーダルへ渡すオブジェクト
export const notFoundTool = (id) => ({
    id: id ? String(id) : '',
    name: '',
    notFound: true,
    pin: null,
    state: 'good',
    lastRent: defaultRentPeriod(),
    reserved: false,
})

// API から取得した工具を貸出モーダル用の形に整える。
// 置き場所の初期値は、借りる人が登録した既定の場所 → 工具の現在地 → 中央 の順に決める。
export const toRentTool = (tool, defaultPin) => ({
    ...tool,
    notFound: false,
    pin: defaultPin ?? tool.pin ?? { x: 50, y: 50 },
    state: tool.state ?? 'good',
    lastRent: defaultRentPeriod(),
    reserved: false,
})
