import React from 'react'

// 各ページ共通の見出し。
// 離れた位置からでもどの画面か分かるよう大きく取り、英字は補助として小さく添える。
const PageTitle = ({ children, en, description }) => {
    return (
        <div className="mb-4 border-b-4 border-line pb-3">
            <div className="flex items-center gap-3">
                <span className="h-9 w-2 shrink-0 rounded bg-accent" aria-hidden="true" />
                <h1 className="text-3xl font-extrabold text-ink">{children}</h1>
                {en && (
                    <span className="ml-1 hidden text-xs tracking-widest text-sub sm:inline">
                        {en}
                    </span>
                )}
            </div>
            {/* 操作に迷わないよう、必要な画面には一言の説明を添える */}
            {description && <p className="pt-2 pl-5 text-base text-sub">{description}</p>}
        </div>
    )
}

export default PageTitle
