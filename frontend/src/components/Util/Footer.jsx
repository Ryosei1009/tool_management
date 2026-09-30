import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { publicUrl } from '../../api'

// 画面下部の固定ナビ。
// 手袋でも押せるよう1項目を大きく取り、アイコンだけに頼らず必ず文字を併記する。
// 現在地は色の反転だけでなく上端のバーと aria-current でも示す。
const items = [
    { to: '/rent', img: publicUrl('/img/footer/rent.png'), label: '借りる' },
    { to: '/rentlist', img: publicUrl('/img/footer/rentlist.png'), label: '借りているもの' },
    { to: '/tools', img: publicUrl('/img/footer/tools.png'), label: '工具リスト' },
    { to: '/mypage', img: publicUrl('/img/footer/mypage.png'), label: 'マイページ' },
]

const Footer = () => {
    const location = useLocation()

    return (
        <nav
            aria-label="メインメニュー"
            className="fixed bottom-0 left-0 z-10 flex w-full items-stretch justify-around border-t-4 border-line bg-main"
        >
            {items.map(({ to, img, label }) => {
                const current = location.pathname === to
                return (
                    <Link
                        key={to}
                        to={to}
                        aria-current={current ? 'page' : undefined}
                        className={`relative flex w-1/4 min-h-touch flex-col items-center justify-center gap-1 px-1 py-2 sm:min-h-touch-lg sm:py-3 ${
                            current ? 'bg-surface text-ink' : 'text-surface'
                        }`}
                    >
                        {/* 現在地は色以外でも分かるように上端にバーを出す */}
                        {current && (
                            <span
                                className="absolute inset-x-0 top-0 h-1.5 bg-accent"
                                aria-hidden="true"
                            />
                        )}
                        <img
                            src={img}
                            alt=""
                            aria-hidden="true"
                            className={`h-9 w-9 sm:h-12 sm:w-12 ${current ? '' : 'invert'}`}
                        />
                        {/* 狭い画面でも折り返さないよう、文字を小さめにして行間を詰める */}
                        <span className="text-center text-xs font-bold leading-tight sm:text-sm">
                            {label}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}

export default Footer
