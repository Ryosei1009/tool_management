import { addDays, currentSlot, nextSlot, slotKey } from './period'

// 貸出のデフォルト期間（日数）
const DEFAULT_RENT_DAYS = 7

// 貸出期間の初期値（今 〜 DEFAULT_RENT_DAYS 日後の午後）
export const defaultRentPeriod = () => {
    const now = currentSlot()
    return {
        start: now.date,
        startPeriod: now.period,
        end: addDays(now.date, DEFAULT_RENT_DAYS),
        endPeriod: 'pm',
    }
}

// 該当する工具が見つからなかったときに貸出モーダルへ渡すオブジェクト
export const notFoundTool = (id) => ({
    id: id ? String(id) : '',
    name: '',
    notFound: true,
    pin: null,
    state: 'good',
    lastRent: defaultRentPeriod(),
})

// API から取得した工具を貸出モーダル用の形に整える。
// 持ち出し場所の初期値は、借りる人が登録した既定の場所 → 工具の現在地 → 中央 の順に決める。
// 貸出中の工具は予約しかできないので、期間の初期値を「返却予定（過ぎていれば今）の次の枠」からにする。
export const toRentTool = (tool, defaultPin) => ({
    ...tool,
    notFound: false,
    pin: defaultPin ?? tool.pin ?? { x: 50, y: 50 },
    state: tool.state ?? 'good',
    lastRent: tool.isRented ? periodAfterRental(tool) : defaultRentPeriod(),
})

const periodAfterRental = (tool) => {
    const now = currentSlot()
    const busyUntil =
        tool.rentEnd && slotKey(tool.rentEnd, tool.rentEndPeriod) > slotKey(now.date, now.period)
            ? { date: tool.rentEnd, period: tool.rentEndPeriod }
            : now
    const start = nextSlot(busyUntil.date, busyUntil.period)
    return {
        start: start.date,
        startPeriod: start.period,
        end: addDays(start.date, DEFAULT_RENT_DAYS),
        endPeriod: 'pm',
    }
}
