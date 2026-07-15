import React from 'react'
import { Link } from 'react-router-dom'

// 全ページ共通のコーポレートヘッダー（大阪富士工業のトーンに準拠）
// 落ち着いたネイビー地に、日本語＋英字併記の企業的な見出し。
const Header = () => {
    return (
        <header className="sticky top-0 z-10 w-full bg-main">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
                <Link to="/tools" className="flex items-baseline gap-3">
                    <span className="text-xl font-bold tracking-wide">工具管理システム</span>
                    <span className="hidden text-xs tracking-[0.25em] text-white/70 sm:inline">
                        TOOL MANAGEMENT
                    </span>
                </Link>
                <span className="text-xs tracking-widest text-white/80">大阪富士工業</span>
            </div>
        </header>
    )
}

export default Header
