// 大項目での絞り込み
const CategorySelect = ({ id = 'category-filter', categories, value, onChange, counts, label = '大項目で絞り込む' }) => (
    <div className="min-w-0">
        <label htmlFor={id} className="block text-base font-bold text-sub">
            {label}
        </label>
        <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            // 絞り込み中は枠を太くして、一覧が絞られていることに気付けるようにする
            className={`min-h-touch w-full rounded-xl bg-surface px-4 text-lg font-bold ${
                value ? 'border-4 border-main' : 'border-2 border-ink'
            }`}
        >
            <option value="">すべて</option>
            {categories.map((c) => (
                <option key={c} value={c}>
                    {c}
                    {counts ? `（${counts[c] ?? 0}）` : ''}
                </option>
            ))}
        </select>
    </div>
)

export default CategorySelect
