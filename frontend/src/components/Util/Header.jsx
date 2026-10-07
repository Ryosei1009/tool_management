import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

// 全ページ共通のヘッダー。
// 工場では「今どのアカウントで操作しているか」を取り違えると貸出記録が狂うため、
// ログイン中の社員名を常時表示する。
const Header = () => {
    const { user } = useAuth()

    return (
        <header className="sticky top-0 z-10 border-b-4 border-line bg-main">
            <div className="absolute inset-x-0 mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
                <div />
                {user && (
                    <Link
                        to="/mypage"
                        className="flex min-w-0 shrink items-center gap-2 rounded-xl border-2 border-black/60 px-3 py-2 sm:px-4"
                    >
                        <span className="truncate text-base text-black font-bold sm:text-lg">{user.name}</span>
                    </Link>
                )}
            </div>
        </header>
    )
}

export default Header
