// 日時と「日付 + 午前/午後」の扱い。
// サーバーや MySQL のタイムゾーン設定に左右されないよう、現在時刻は日本時間で求めて
// 'YYYY-MM-DD HH:MM:SS' の文字列として DB に入れる。

const TIME_ZONE = 'Asia/Tokyo';

const PERIODS = { am: '午前', pm: '午後' };
const isPeriod = (value) => value === 'am' || value === 'pm';

// 日本時間の現在日時 'YYYY-MM-DD HH:MM:SS'
const nowJst = () => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        })
            .formatToParts(new Date())
            .map((p) => [p.type, p.value])
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};

// 現在の半日枠 { date, period }（12時より前は午前）
const currentSlot = () => {
    const now = nowJst();
    return { date: now.slice(0, 10), period: Number(now.slice(11, 13)) < 12 ? 'am' : 'pm' };
};

// 半日枠を比較できる文字列にする（'2026-10-07:0' が午前、':1' が午後）
const slotKey = (date, period) => `${String(date).slice(0, 10)}:${period === 'am' ? 0 : 1}`;

// 2つの期間 { start, end }（slotKey）が1枠でも重なるか
const overlaps = (a, b) => a.start <= b.end && b.start <= a.end;

// rentals の1行を比較用の期間にする。
// 貸出中で返却予定を過ぎているものは、まだ返ってきていないので「今」まで延ばして扱う。
const rentalRange = (row, now = currentSlot()) => {
    const start = slotKey(row.start_date, row.start_period);
    let end = slotKey(row.end_date, row.end_period);
    const nowKey = slotKey(now.date, now.period);
    if (row.status === 'renting' && end < nowKey) end = nowKey;
    return { start, end };
};

// 「10月7日」
const toJpDate = (value) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
    return m ? `${Number(m[2])}月${Number(m[3])}日` : '';
};

// 「10月7日 午後」
const toJpSlot = (date, period) => {
    const d = toJpDate(date);
    if (!d) return '';
    return isPeriod(period) ? `${d} ${PERIODS[period]}` : d;
};

// 「10月7日 9:05」
const toJpDateTime = (value) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value ?? ''));
    return m ? `${Number(m[2])}月${Number(m[3])}日 ${Number(m[4])}:${m[5]}` : '';
};

// 「2026/10/07 9:05」（年をまたぐ履歴用）
const toFullDateTime = (value) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value ?? ''));
    return m ? `${m[1]}/${m[2]}/${m[3]} ${Number(m[4])}:${m[5]}` : '';
};

module.exports = {
    PERIODS,
    isPeriod,
    nowJst,
    currentSlot,
    slotKey,
    overlaps,
    rentalRange,
    toJpDate,
    toJpSlot,
    toJpDateTime,
    toFullDateTime,
};
