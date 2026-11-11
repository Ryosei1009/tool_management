// 点検の周期と期限。
// 次回点検日 = 最終点検日 + 周期（月）。期限の 30 日前から「まもなく」、過ぎたら「期限切れ」。
const { isRope } = require('./search');

const SOON_DAYS = 30;
// ロープは周期を設定していなくても 3 か月で点検する（従来の決まり）
const ROPE_DEFAULT_MONTHS = 3;

const parse = (value) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
    return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

const pad = (n) => String(n).padStart(2, '0');

// 月を足す。31日 + 1か月のように存在しない日は、その月の末日にする。
const addMonths = (isoDate, months) => {
    const p = parse(isoDate);
    if (!p) return '';
    const total = p.y * 12 + (p.m - 1) + months;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${pad(m)}-${pad(Math.min(p.d, last))}`;
};

const daysBetween = (fromIso, toIso) => {
    const a = parse(fromIso);
    const b = parse(toIso);
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
};

// 実際に使う周期（月）。設定がなければロープだけ 3 か月、それ以外は期限なし（null）。
const effectiveInterval = (row) => {
    const months = Number(row.inspection_interval_months);
    if (Number.isInteger(months) && months > 0) return months;
    return isRope(row.category) ? ROPE_DEFAULT_MONTHS : null;
};

// { intervalMonths, nextDate, daysLeft, status }
//   status: none（期限なし）/ ok / soon（30日以内）/ overdue（期限切れ・未点検）
const inspectionInfo = (row, today) => {
    const intervalMonths = effectiveInterval(row);
    if (!intervalMonths) return { intervalMonths: null, nextDate: '', daysLeft: null, status: 'none' };

    const last = String(row.last_inspection_date ?? '').slice(0, 10);
    if (!parse(last)) return { intervalMonths, nextDate: '', daysLeft: null, status: 'overdue' };

    const nextDate = addMonths(last, intervalMonths);
    const daysLeft = daysBetween(today, nextDate);
    const status = daysLeft < 0 ? 'overdue' : daysLeft <= SOON_DAYS ? 'soon' : 'ok';
    return { intervalMonths, nextDate, daysLeft, status };
};

module.exports = { SOON_DAYS, ROPE_DEFAULT_MONTHS, addMonths, daysBetween, effectiveInterval, inspectionInfo };
