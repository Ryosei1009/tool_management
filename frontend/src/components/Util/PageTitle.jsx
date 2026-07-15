import React from 'react'

// 各ページ共通の見出し。左の赤いアクセントバー＋日本語見出し＋英字（任意）。
// 日本語コーポレートサイトで定番の、落ち着いた見出しスタイル。
const PageTitle = ({ children, en }) => {
    return (
        <div className="mb-6 flex items-center gap-3 border-b border-line pb-3">
            <span className="h-6 w-1.5 shrink-0 rounded bg-accent" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-ink">{children}</h1>
            {en && (
                <span className="ml-1 hidden text-xs tracking-widest text-sub sm:inline">
                    {en}
                </span>
            )}
        </div>
    )
}

export default PageTitle
