// 貸出期間の「日付 + 午前/午後」（半日単位）の扱い。値は backend の rentals.*_period と一致させる。
export const PERIODS = [
    { value: 'am', label: '午前' },
    { value: 'pm', label: '午後' },
]

export const getPeriodLabel = (period) => PERIODS.find((p) => p.value === period)?.label ?? ''

const pad = (n) => String(n).padStart(2, '0')
export const toIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// 今の半日枠 { date, period }（12時より前は午前）
export const currentSlot = (now = new Date()) => ({
    date: toIsoDate(now),
    period: now.getHours() < 12 ? 'am' : 'pm',
})

// 比較用の文字列（'2026-10-07:0' が午前、':1' が午後）
export const slotKey = (date, period) => `${date}:${period === 'am' ? 0 : 1}`

export const overlaps = (a, b) => a.start <= b.end && b.start <= a.end

// 「10月7日（水）午後」
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
export const formatSlot = (date, period) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '')
    if (!m) return ''
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）${getPeriodLabel(period)}`
}

// 日付に n 日足す（YYYY-MM-DD）
export const addDays = (date, n) => {
    const [y, m, d] = date.split('-').map(Number)
    return toIsoDate(new Date(y, m - 1, d + n))
}

// 次の半日枠（午前 → 同じ日の午後、午後 → 翌日の午前）
export const nextSlot = (date, period) =>
    period === 'am' ? { date, period: 'pm' } : { date: addDays(date, 1), period: 'am' }

// 予約・貸出の一覧（API の reservations や貸出中の情報）から、
// range と重なっているものを返す。exceptRentalId は自分自身。
// 貸出中で返却予定を過ぎているものは、まだ戻っていないので「今」まで延ばして比べる。
export const findConflicts = (range, entries, exceptRentalId) => {
    const nowKey = slotKey(currentSlot().date, currentSlot().period)
    return entries.filter((e) => {
        if (e.rentalId === exceptRentalId) return false
        let end = slotKey(e.end, e.endPeriod)
        if (e.renting && end < nowKey) end = nowKey
        return overlaps(range, { start: slotKey(e.start, e.startPeriod), end })
    })
}

// 工具詳細（fetchTool の結果）から、期間の重なりを調べる対象の一覧を作る
export const toolOccupancy = (tool) => [
    ...(tool?.isRented
        ? [
              {
                  rentalId: tool.rentalId,
                  user: tool.user,
                  start: tool.rentStart,
                  startPeriod: tool.rentStartPeriod,
                  end: tool.rentEnd,
                  endPeriod: tool.rentEndPeriod,
                  label: `${tool.startDate} 〜 ${tool.endDate}`,
                  renting: true,
              },
          ]
        : []),
    ...(tool?.reservations ?? []).map((r) => ({ ...r, renting: false })),
]

// 返却期限の状況。午前の期限は 12:00、午後の期限はその日の終わりとみなす。
export const getDueInfo = (endDate, endPeriod, now = new Date()) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate ?? '')
    if (!m) return null
    const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), endPeriod === 'am' ? 12 : 24)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dueDay = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    const days = Math.round((dueDay - today) / 86400000)
    const label = getPeriodLabel(endPeriod)

    if (now > due) {
        return {
            label: days < 0 ? `返却期限を ${-days} 日過ぎています` : `返却期限（今日の${label}）を過ぎています`,
            urgent: true,
        }
    }
    if (days === 0) return { label: `今日の${label}が返却期限です`, urgent: true }
    if (days <= 3) return { label: `返却期限まで あと ${days} 日（${label}）`, urgent: false }
    return null
}
