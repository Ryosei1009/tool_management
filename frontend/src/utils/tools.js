import tools from '../data/tools.json'

// 貸出のデフォルト期間（日数）
const DEFAULT_RENT_DAYS = 7

const formatDate = (d) =>
    d
        .toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
        .replace(/\//g, '-')

// QR/検索で得たID（または工具名）から工具マスタを検索する
export const findToolById = (id) => {
    if (!id) return null
    const key = String(id).trim()
    return tools.find((t) => t.id === key || t.name === key) ?? null
}

// 貸出モーダル用の工具オブジェクトを組み立てる。
// 期間（lastRent）は本日から DEFAULT_RENT_DAYS 日後を初期値とする。
export const buildRentTool = (id) => {
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + DEFAULT_RENT_DAYS)
    const lastRent = { start: formatDate(start), end: formatDate(end) }

    const found = findToolById(id)
    if (!found) {
        // 該当する工具が見つからなかった場合
        return {
            id: id ? String(id) : '',
            name: '',
            notFound: true,
            pin: null,
            state: 'good',
            lastRent,
            reserved: false,
        }
    }

    return {
        id: found.id,
        name: found.name,
        photoUrl: found.photoUrl,
        pin: found.pin ?? { x: 50, y: 50 },
        state: found.state ?? 'good',
        lastInspectionDate: found.lastInspectionDate,
        lastRent,
        reserved: false,
    }
}
