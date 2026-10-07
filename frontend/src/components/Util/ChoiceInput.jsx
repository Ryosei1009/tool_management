import { useState } from 'react'

const NEW = '__new__'

// 既存の値から選ぶか、新しく入力するかの入力欄（大項目・所属班など）。
// <datalist> は入力済みの文字で候補が絞られて何も出なくなる・iPad では候補が出にくいため、
// 確実に一覧が出る選択欄にし、最後の「新しく入力する」で自由入力の欄を出す。
const ChoiceInput = ({ id, value, onChange, options, maxLength, placeholder, className = '' }) => {
    // 一覧に無い値が入っているときは、最初から入力欄を出す
    const [custom, setCustom] = useState(() => Boolean(value) && !options.includes(value))
    const isCustom = custom || (Boolean(value) && !options.includes(value))

    return (
        <div className="flex flex-col gap-2">
            <select
                id={id}
                value={isCustom ? NEW : value}
                onChange={(e) => {
                    if (e.target.value === NEW) {
                        setCustom(true)
                        onChange('')
                    } else {
                        setCustom(false)
                        onChange(e.target.value)
                    }
                }}
                className={className}
            >
                <option value="">未設定</option>
                {options.map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
                <option value={NEW}>＋ 新しく入力する</option>
            </select>
            {isCustom && (
                <input
                    type="text"
                    aria-label="新しい値"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    autoFocus
                    className={className}
                />
            )}
        </div>
    )
}

export default ChoiceInput
