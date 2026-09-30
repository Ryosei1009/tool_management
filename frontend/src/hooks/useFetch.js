import { useCallback, useEffect, useState } from 'react'

// API 取得の定型（読み込み中 / エラー / 再取得）をまとめた小さなフック。
// fn は useCallback 済みの関数を渡すこと。
// enabled=false の間は取得しない（閉じているモーダルなど）。
export const useFetch = (fn, { enabled = true } = {}) => {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(enabled)
    const [error, setError] = useState('')
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
                setLoading(false)
            })
            .catch((err) => {
                if (ignore) return
                setError(err.message)
                setLoading(false)
            })
        // アンマウント後・再取得時に古い結果を反映しない
        return () => {
            ignore = true
        }
    }, [fn, nonce, enabled])

    return { data, loading, error, reload, setData }
}
