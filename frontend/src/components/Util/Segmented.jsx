// 大きなボタンを横に並べた択一の切り替え（午前/午後、今すぐ借りる/予約する など）。
// 手袋でも押せる高さにし、選択中は色の反転に加えて ✓ と太枠でも示す。
const Segmented = ({ label, options, value, onChange, disabled = false, size = 'md', className = '' }) => (
    <div role="radiogroup" aria-label={label} className={`flex gap-2 ${className}`}>
        {options.map((o) => {
            const selected = o.value === value
            return (
                <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled || o.disabled}
                    onClick={() => onChange(o.value)}
                    className={`min-h-touch flex-1 rounded-xl px-3 font-extrabold ${
                        size === 'lg' ? 'text-xl' : 'text-lg'
                    } ${selected ? 'border-4 border-main bg-main text-surface' : 'border-2 border-ink bg-surface text-ink'}`}
                >
                    {selected && (
                        <span aria-hidden="true" className="mr-1">
                            ✓
                        </span>
                    )}
                    {o.label}
                </button>
            )
        })}
    </div>
)

export default Segmented
