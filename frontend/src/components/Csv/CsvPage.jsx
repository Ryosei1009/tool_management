import { useState } from 'react'
import PageTitle from '../Util/PageTitle'
import Button from '../Util/Button'
import { Empty } from '../Util/AsyncState'
import {
    downloadEmployeesCsv,
    downloadInspectionsCsv,
    downloadRentalsCsv,
    downloadToolsCsv,
    importCsv,
} from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { isAdmin } from '../../utils/roles'

const inputClass = 'w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold'

const SubHeading = ({ children }) => (
    <h2 className="flex items-center gap-3 pb-3 text-2xl font-extrabold">
        <span className="h-7 w-1.5 shrink-0 rounded bg-steel" aria-hidden="true" />
        {children}
    </h2>
)

const Card = ({ title, description, children }) => (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
        <h3 className="text-xl font-extrabold">{title}</h3>
        <p className="text-base text-sub">{description}</p>
        {children}
    </div>
)

/* ---------------- 出力 ---------------- */

// ボタン1つの出力。押している間は二重に押せないようにし、結果を文字で伝える。
const useDownload = () => {
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const run = async (key, action) => {
        setBusy(key)
        setMessage('')
        setError('')
        try {
            const name = await action()
            setMessage(`${name} を保存しました。`)
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy('')
        }
    }
    return { busy, message, error, run }
}

const ExportSection = () => {
    const { busy, message, error, run } = useDownload()
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const invalidRange = Boolean(from && to && from > to)

    return (
        <section className="mb-10">
            <SubHeading>出力する</SubHeading>
            <div className="grid gap-4 md:grid-cols-2">
                <Card
                    title="工具台帳"
                    description="すべての工具の一覧です（状態・購入日・最終点検日・次回点検日・貸出状況）。無効化した工具も含みます。"
                >
                    <Button disabled={Boolean(busy)} onClick={() => run('tools', downloadToolsCsv)}>
                        {busy === 'tools' ? '出力中...' : '工具台帳を出力'}
                    </Button>
                </Card>

                <Card
                    title="貸出・点検の履歴"
                    description="期間を指定して出力します。空のままにすると、すべての期間を出力します。"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label htmlFor="csv-from" className="text-base font-bold">
                                開始日
                            </label>
                            <input
                                id="csv-from"
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="csv-to" className="text-base font-bold">
                                終了日
                            </label>
                            <input
                                id="csv-to"
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>
                    {invalidRange && (
                        <p role="alert" className="text-lg font-bold text-accent">
                            ✕ 開始日は終了日より前にしてください。
                        </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            className="flex-1"
                            disabled={Boolean(busy) || invalidRange}
                            onClick={() => run('rentals', () => downloadRentalsCsv({ from, to }))}
                        >
                            {busy === 'rentals' ? '出力中...' : '貸出履歴を出力'}
                        </Button>
                        <Button
                            className="flex-1"
                            disabled={Boolean(busy) || invalidRange}
                            onClick={() => run('inspections', () => downloadInspectionsCsv({ from, to }))}
                        >
                            {busy === 'inspections' ? '出力中...' : '点検履歴を出力'}
                        </Button>
                    </div>
                </Card>
            </div>

            {message && (
                <p role="status" className="pt-4 text-lg font-bold text-state-good">
                    {message}
                </p>
            )}
            {error && (
                <p role="alert" className="pt-4 text-lg font-bold text-accent">
                    ✕ {error}
                </p>
            )}
        </section>
    )
}

/* ---------------- 取り込み ---------------- */

const ACTION_LABELS = { create: '新規登録', update: '更新', error: 'エラー' }

// 取り込み前の確認結果。エラーの行を先に、何が問題かを文字で出す。
const Preview = ({ result }) => {
    const { summary, rows } = result
    const errors = rows.filter((r) => r.action === 'error')
    const others = rows.filter((r) => r.action !== 'error')

    return (
        <div className="flex flex-col gap-3">
            <p className="text-lg font-extrabold">
                全 {summary.total} 行：新規登録 {summary.create} 件 ／ 更新 {summary.update} 件 ／{' '}
                <span className={summary.error > 0 ? 'text-accent' : ''}>エラー {summary.error} 件</span>
            </p>

            {errors.length > 0 && (
                <ul className="flex flex-col gap-2 rounded-xl border-2 border-accent p-4">
                    {errors.map((r) => (
                        <li key={r.line} className="text-lg font-bold">
                            <span className="text-accent">
                                ✕ {r.line} 行目{r.id && `（${r.id}）`}
                            </span>
                            <ul className="pl-6 text-base">
                                {r.messages.map((m) => (
                                    <li key={m}>{m}</li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}

            {others.length > 0 && (
                <div className="max-h-72 overflow-y-auto rounded-xl border-2 border-line bg-field p-4">
                    <ul className="flex flex-col gap-1">
                        {others.map((r) => (
                            <li key={r.line} className="text-lg font-bold">
                                <span className="mr-3 inline-block w-24 text-base text-sub">{ACTION_LABELS[r.action]}</span>
                                {r.id}
                                {r.name && <span className="ml-3">{r.name}</span>}
                                {r.passwordReset && (
                                    <span className="ml-3 text-base text-state-bad">▲ パスワードを初期化します</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

// ファイルを選ぶ → 内容を確認する（登録はしない）→ 問題がなければ登録する、の順に進める。
const ImportCard = ({ kind, title, description, columns, onTemplate }) => {
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    // 同じファイルを選び直せるよう、登録のあとで入力欄を作り直す
    const [inputKey, setInputKey] = useState(0)

    const check = async (selected) => {
        setFile(selected)
        setPreview(null)
        setError('')
        setMessage('')
        if (!selected) return
        setBusy(true)
        try {
            setPreview(await importCsv(kind, selected, { dryRun: true }))
        } catch (err) {
            setError(err.message)
        } finally {
            setBusy(false)
        }
    }

    const commit = async () => {
        setBusy(true)
        setError('')
        try {
            const result = await importCsv(kind, file)
            setMessage(`登録しました（新規登録 ${result.summary.create} 件・更新 ${result.summary.update} 件）。`)
            setFile(null)
            setPreview(null)
            setInputKey((k) => k + 1)
        } catch (err) {
            // 確認のあとで他の人が変更したなどでエラーになったときは、その内容を出す
            if (err.data?.rows) setPreview(err.data)
            setError(err.message)
        } finally {
            setBusy(false)
        }
    }

    const canCommit = preview && preview.summary.error === 0 && preview.summary.total > 0 && !busy

    return (
        <Card title={title} description={description}>
            <p className="text-base font-bold">
                <span className="mr-2 text-sub">列（1行目の見出し）</span>
                {columns}
            </p>
            <Button variant="secondary" size="md" onClick={onTemplate} disabled={busy}>
                今の内容を出力する（ひな形として使えます）
            </Button>

            <label htmlFor={`csv-file-${kind}`} className="pt-2 text-lg font-bold">
                取り込む CSV ファイル
            </label>
            <input
                key={inputKey}
                id={`csv-file-${kind}`}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => check(e.target.files?.[0] ?? null)}
                className="block w-full text-base file:mr-4 file:min-h-touch file:rounded-xl file:border-2 file:border-ink file:bg-surface file:px-6 file:text-lg file:font-extrabold file:text-ink"
            />

            {busy && (
                <p role="status" className="text-lg font-bold text-sub">
                    確認中...
                </p>
            )}
            {error && (
                <p role="alert" className="text-lg font-bold text-accent">
                    ✕ {error}
                </p>
            )}
            {preview && <Preview result={preview} />}
            {preview && preview.summary.error > 0 && (
                <p className="text-lg font-bold text-accent">
                    エラーの行を直してから、ファイルを選び直してください。エラーがある間は1件も登録されません。
                </p>
            )}
            {message && (
                <p role="status" className="text-lg font-bold text-state-good">
                    {message}
                </p>
            )}

            {preview && (
                <Button onClick={commit} disabled={!canCommit}>
                    {busy ? '登録中...' : 'この内容で登録する'}
                </Button>
            )}
        </Card>
    )
}

const ImportSection = () => {
    const [error, setError] = useState('')
    const template = (action) => () => {
        setError('')
        action().catch((err) => setError(err.message))
    }

    return (
        <section className="mb-10">
            <SubHeading>まとめて登録・更新する</SubHeading>
            <p className="pb-4 text-base text-sub">
                ファイルを選ぶと、まず内容の確認だけを行います（この時点では登録されません）。
                Excel で編集した CSV（UTF-8 / Shift_JIS）をそのまま使えます。
                ID が登録済みの行は更新、未登録の行は新規登録になります。
            </p>
            {error && (
                <p role="alert" className="pb-4 text-lg font-bold text-accent">
                    ✕ {error}
                </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
                <ImportCard
                    kind="tools"
                    title="工具"
                    description="工具台帳と同じ形式です。出力した工具台帳を編集して、そのまま取り込めます。空にしたセルは「未設定」になります。"
                    columns="工具ID / 名前 / 大項目 / 購入日 / 状態 / 不良ランク / 不良内容 / 最終点検日 / 点検の周期（月）"
                    onTemplate={template(downloadToolsCsv)}
                />
                <ImportCard
                    kind="employees"
                    title="社員"
                    description="新しい社員には初期パスワードが必要です（本人が初回ログインで変更します）。登録済みの社員は、初期パスワードを入れた行だけパスワードを初期化します。"
                    columns="社員ID / 社員名 / 所属班 / 権限 / 血液型 / 初期パスワード"
                    onTemplate={template(downloadEmployeesCsv)}
                />
            </div>
        </section>
    )
}

// CSV の入出力（管理者のみ）
const CsvPage = () => {
    const { user } = useAuth()

    if (!isAdmin(user)) {
        return (
            <div className="px-6 pt-8 pb-nav">
                <Empty>この画面は管理者のみ利用できます</Empty>
            </div>
        )
    }

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-6">
                <PageTitle en="CSV" description="工具台帳・履歴の出力と、工具・社員の一括登録ができます。">
                    CSV の入出力
                </PageTitle>
                <ExportSection />
                <ImportSection />
            </div>
        </div>
    )
}

export default CsvPage
