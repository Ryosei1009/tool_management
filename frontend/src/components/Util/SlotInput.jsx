import Segmented from './Segmented'
import { PERIODS } from '../../utils/period'

// 「日付 + 午前/午後」の入力。返却予定・予約の開始に使う。
const SlotInput = ({ id, label, date, period, onChange, min, disabled = false }) => (
    <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-base text-sub">
            {label}
        </label>
        <input
            id={id}
            type="date"
            value={date}
            min={min}
            disabled={disabled}
            onChange={(e) => onChange({ date: e.target.value, period })}
            className="w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold"
        />
        <Segmented
            label={`${label}（午前・午後）`}
            options={PERIODS}
            value={period}
            disabled={disabled}
            onChange={(p) => onChange({ date, period: p })}
        />
    </div>
)

export default SlotInput
