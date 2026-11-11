import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchNotifications } from '../../api'

// 画面上部の帯。
// ・オフライン（通信できない）のとき、その旨と「もう一度確認する」ボタンを出す
// ・返却遅れ・点検期限などのお知らせを出す（押すと対応する画面へ）
// 色だけに頼らず、アイコン（✕ / ▲）と文字で伝える。

// ヘッダー右上の社員名（ページの上に重なって表示される）と重ならないよう、その下から始める
const BELOW_HEADER = 'mt-[4.75rem]'

// 通信できているか。ブラウザの online/offline と、実際の通信の成否（tm:network）の両方を見る。
const useOnline = () => {
    const [online, setOnline] = useState(() => navigator.onLine !== false)

    useEffect(() => {
        const up = () => setOnline(true)
        const down = () => setOnline(false)
        const onNetwork = (e) => setOnline(Boolean(e.detail?.online))
        window.addEventListener('online', up)
        window.addEventListener('offline', down)
        window.addEventListener('tm:network', onNetwork)
        return () => {
            window.removeEventListener('online', up)
            window.removeEventListener('offline', down)
            window.removeEventListener('tm:network', onNetwork)
        }
    }, [])

    return online
}

const NoticeBar = () => {
    const online = useOnline()
    const location = useLocation()
    const [notices, setNotices] = useState([])
    const [checking, setChecking] = useState(false)

    // 取得に失敗しても画面の操作は止めない（オフラインの表示は tm:network で切り替わる）
    const load = useCallback(
        () =>
            fetchNotifications()
                .then((list) => setNotices(Array.isArray(list) ? list : []))
                .catch(() => {}),
        []
    )

    // 画面を移るたび・通信が戻ったとき・5分ごとに取り直す（返却や点検のあとすぐ消えるように）
    useEffect(() => {
        if (!online) return
        load()
        const timer = setInterval(load, 5 * 60 * 1000)
        return () => clearInterval(timer)
    }, [load, online, location.pathname])

    // 貸出・返却・点検などの操作のあとにも取り直す
    useEffect(() => {
        window.addEventListener('tm:changed', load)
        return () => window.removeEventListener('tm:changed', load)
    }, [load])

    const retry = async () => {
        setChecking(true)
        await load()
        setChecking(false)
    }

    if (!online) {
        return (
            <div
                role="alert"
                className={`${BELOW_HEADER} flex flex-wrap items-center justify-between gap-3 bg-accent px-4 py-3 text-surface`}
            >
                <p className="text-lg font-extrabold">
                    <span aria-hidden="true" className="mr-2">
                        ✕
                    </span>
                    オフラインです。貸出・返却は記録されません。電波の良い場所で操作してください。
                </p>
                <button
                    type="button"
                    onClick={retry}
                    disabled={checking}
                    className="min-h-touch shrink-0 rounded-xl border-2 border-white px-6 text-lg font-extrabold"
                >
                    {checking ? '確認中...' : 'もう一度確認する'}
                </button>
            </div>
        )
    }

    if (notices.length === 0) return null

    return (
        <ul aria-label="お知らせ" className={`${BELOW_HEADER} flex flex-col`}>
            {notices.map((n) => {
                const danger = n.level === 'danger'
                return (
                    <li key={n.id}>
                        <Link
                            to={n.to}
                            className={`touch-target flex items-center gap-3 border-b-2 px-4 py-2 text-lg font-extrabold ${
                                danger
                                    ? 'border-white/40 bg-accent text-surface'
                                    : 'border-state-bad bg-surface text-state-bad'
                            }`}
                        >
                            <span aria-hidden="true">{danger ? '✕' : '▲'}</span>
                            <span className="min-w-0 flex-1">{n.text}</span>
                            <span aria-hidden="true" className="shrink-0 text-base">
                                確認する ›
                            </span>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}

export default NoticeBar
