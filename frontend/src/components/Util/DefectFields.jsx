import { DEFECT_RANKS } from '../../utils/toolInfo'

// 不良のランクと内容の入力。状態が「不良」のときに出す。
// ランクは選択肢が少ないので、選択欄ではなく押しやすい大きなボタンにする。
// 選んだときの色（DefectRankBadge と合わせる）
const SELECTED = { replace: 'border-accent bg-accent', waiting: 'border-steel bg-steel' }

const DefectFields = ({ idPrefix, rank, note, onChange }) => (
    <fieldset className="flex flex-col gap-3 rounded-xl border-2 border-state-bad bg-field p-4">
        <legend className="px-1 text-lg font-bold">不良の内容</legend>

        <div role="radiogroup" aria-label="不良ランク" className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
                {DEFECT_RANKS.map((r) => {
                    const selected = rank === r.value
                    return (
                        <button
                            key={r.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => onChange({ rank: selected ? null : r.value, note })}
                            className={`min-h-touch rounded-xl px-3 text-lg font-extrabold ${
                                selected
                                    ? `border-4 ${SELECTED[r.value] ?? 'border-state-bad bg-state-bad'} text-surface`
                                    : 'border-2 border-ink bg-surface text-ink'
                            }`}
                        >
                            {selected && (
                                <span aria-hidden="true" className="mr-1">
                                    ✓
                                </span>
                            )}
                            {r.label}
                        </button>
                    )
                })}
            </div>
        </div>

        <div className="flex flex-col gap-2">
            <label htmlFor={`${idPrefix}-defect-note`} className="text-base text-sub">
                詳しい内容（どこが・どうなっているか）
            </label>
            <textarea
                id={`${idPrefix}-defect-note`}
                value={note ?? ''}
                onChange={(e) => onChange({ rank, note: e.target.value })}
                rows={3}
                maxLength={1000}
                placeholder="例：刃先が欠けて細い線が切れない"
                className="w-full rounded-xl border-2 border-ink bg-surface px-4 py-3 text-lg font-bold"
            />
        </div>
    </fieldset>
)

export default DefectFields
