import { useCallback, useEffect, useState } from 'react'

// 通信できなかったときに、自動でやり直すまでの間隔（ミリ秒）。回を追うごとに長くする。
const RETRY_DELAYS = [3000, 6000, 12000, 30000]

// API 取得の定型（読み込み中 / エラー / 再取得）をまとめた小さなフック。
// fn は useCallback 済みの関数を渡すこと。
// enabled=false の間は取得しない（閉じているモーダルなど）。
// 通信できずに失敗したとき（圏外など）は、間隔をあけて自動でやり直し、
// 通信が戻ったら（online イベント）すぐに取り直す。
export const useFetch = (fn, { enabled = true } = {}) => {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(enabled)
    const [error, setError] = useState('')
    // 通信できずに失敗した回数（0 なら通信の問題ではない）
    const [offlineCount, setOfflineCount] = useState(0)
    // reload() のたびに値を変えて effect を再実行させる
    const [nonce, setNonce] = useState(0)

    const reload = useCallback(() => setNonce((n) => n + 1), [])

    useEffect(() => {
        if (!enabled) return
        let ignore = false
        // effect の中で同期的に setState しないよう、状態更新は必ず非同期側で行う
        Promise.resolve()
            .then(fn)
            .then((result) => {
                if (ignore) return
                setData(result)
                setError('')
                setOfflineCount(0)
                setLoading(false)
            })
            .catch((err) => {
                if (ignore) return
                setError(err.message)
                setOfflineCount((n) => (err.status === 0 ? n + 1 : 0))
                setLoading(false)
            })
        // アンマウント後・再取得時に古い結果を反映しない
        return () => {
            ignore = true
        }
    }, [fn, nonce, enabled])

    useEffect(() => {
        if (offlineCount === 0) return
        const delay = RETRY_DELAYS[Math.min(offlineCount, RETRY_DELAYS.length) - 1]
        const timer = setTimeout(reload, delay)
        window.addEventListener('online', reload)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('online', reload)
        }
    }, [offlineCount, reload])

    return { data, loading, error, reload, setData }
}
