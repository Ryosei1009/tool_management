import React from 'react'

// 工場で手袋をしたまま押す前提の大きなボタン。
// 主要操作は高さ 72px 以上、文字は太く大きく、色に加えて文言で意味を伝える。
const VARIANTS = {
    // 主要操作（借りる・更新・追加など）
    primary: 'bg-main text-surface border-main',
    // 注意を要する操作（返す・削除など）
    danger: 'bg-accent text-surface border-accent',
    // 副次的な操作
    secondary: 'bg-surface text-ink border-ink',
}

const SIZES = {
    md: 'min-h-touch px-6 text-lg',
    lg: 'min-h-touch-lg px-8 text-xl',
}

const Button = ({
    variant = 'primary',
    size = 'lg',
    icon,
    className = '',
    children,
    ...props
}) => (
    <button
        type="button"
        className={`inline-flex items-center justify-center gap-3 rounded-xl border-2 font-extrabold ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
        {...props}
    >
        {icon && (
            <span className="text-2xl leading-none" aria-hidden="true">
                {icon}
            </span>
        )}
        {children}
    </button>
)

export default Button
