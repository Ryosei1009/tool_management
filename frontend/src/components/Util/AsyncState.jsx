import React from 'react'

// API 取得中 / エラー / 空の表示をまとめた共通コンポーネント。
// 工場では画面を注視しないことも多いため、状態は大きな文字とアイコンで示す。
export const Loading = ({ children = '読み込み中...' }) => (
    <p role="status" className="py-16 text-center text-xl font-bold text-sub">
        {children}
    </p>
)

export const ErrorMessage = ({ message, onRetry }) => (
    <div role="alert" className="flex flex-col items-center gap-4 py-16">
        <p className="flex items-center gap-3 text-center text-xl font-bold text-accent">
            <span aria-hidden="true">✕</span>
            {message}
        </p>
        {onRetry && (
            <button
                type="button"
                onClick={onRetry}
                className="min-h-touch rounded-xl border-2 border-ink px-8 text-lg font-extrabold"
            >
                再読み込み
            </button>
        )}
    </div>
)

export const Empty = ({ children = '該当するデータがありません' }) => (
    <p className="py-16 text-center text-xl font-bold text-sub">{children}</p>
)
