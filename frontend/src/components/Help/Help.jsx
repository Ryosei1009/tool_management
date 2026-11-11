import { useState } from 'react'
import PageTitle from '../Util/PageTitle'
import SearchBar from '../Util/SearchBar'
import Segmented from '../Util/Segmented'
import { Empty } from '../Util/AsyncState'
import { useAuth } from '../../auth/AuthContext'
import { matchesKeyword } from '../../utils/search'
import { FAQ_SECTIONS, HELP_CONTACT } from './faq'

// 権限で見せる質問を絞る（roles を省略したものは全員に見せる）
const visibleTo = (permission) => (entry) => !entry.roles || entry.roles.includes(permission)

// 質問1件。押すと答えが開く（<details> なので、読み上げにも開閉が伝わる）。
// 手袋でも押せるよう、質問の行は大きく取る。
const Question = ({ item, open }) => (
    <details open={open} className="group rounded-2xl border-2 border-ink bg-surface">
        <summary className="flex min-h-touch cursor-pointer list-none items-center gap-3 px-4 py-3 text-xl font-extrabold [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="shrink-0 text-accent">
                Q
            </span>
            <span className="min-w-0 flex-1">{item.q}</span>
            <span aria-hidden="true" className="shrink-0 text-base font-bold text-sub group-open:hidden">
                ＋ 開く
            </span>
            <span aria-hidden="true" className="hidden shrink-0 text-base font-bold text-sub group-open:inline">
                − 閉じる
            </span>
        </summary>
        <div className="border-t-2 border-dashed border-line px-4 py-4 text-lg font-bold leading-relaxed">
            {item.steps && (
                <ol className="mb-3 flex flex-col gap-2">
                    {item.steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                            <span
                                aria-hidden="true"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-main text-base text-surface"
                            >
                                {i + 1}
                            </span>
                            <span className="min-w-0 pt-0.5">{step}</span>
                        </li>
                    ))}
                </ol>
            )}
            {item.text && <p className={item.steps ? 'text-sub' : ''}>{item.text}</p>}
        </div>
    </details>
)

// 使い方ガイド・FAQ
const Help = () => {
    const { user } = useAuth()
    const [keyword, setKeyword] = useState('')
    const [sectionId, setSectionId] = useState('all')

    const canSee = visibleTo(user?.permission)
    const sections = FAQ_SECTIONS.filter(canSee)
        .map((s) => ({ ...s, items: s.items.filter(canSee) }))
        .filter((s) => s.items.length > 0)

    const searching = keyword.trim() !== ''
    const shown = sections
        .filter((s) => searching || sectionId === 'all' || s.id === sectionId)
        .map((s) => ({
            ...s,
            items: s.items.filter((item) =>
                matchesKeyword(keyword, [item.q, item.text, ...(item.steps ?? [])])
            ),
        }))
        .filter((s) => s.items.length > 0)
    const count = shown.reduce((n, s) => n + s.items.length, 0)

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-6">
                <PageTitle en="HELP" description="質問を押すと答えが開きます。言葉で探すこともできます。">
                    使い方ガイド・FAQ
                </PageTitle>

                <SearchBar
                    keyword={keyword}
                    onChange={setKeyword}
                    label="質問を探す"
                    placeholder="例：パスワード / 返す / オフライン"
                />

                {!searching && (
                    <Segmented
                        label="表示する分類"
                        options={[
                            { value: 'all', label: 'すべて' },
                            ...sections.map((s) => ({ value: s.id, label: s.title })),
                        ]}
                        value={sectionId}
                        onChange={setSectionId}
                        className="mb-6 flex-wrap"
                    />
                )}

                {searching && (
                    <p role="status" className="mb-4 text-xl font-extrabold">
                        {count} 件
                    </p>
                )}

                {count === 0 ? (
                    <Empty>当てはまる質問がありません。別の言葉で探すか、下の問い合わせ先に連絡してください。</Empty>
                ) : (
                    shown.map((section) => (
                        <section key={section.id} className="mb-8">
                            <h2 className="flex items-center gap-3 pb-3 text-2xl font-extrabold">
                                <span className="h-7 w-1.5 shrink-0 rounded bg-steel" aria-hidden="true" />
                                {section.title}
                            </h2>
                            <div className="flex flex-col gap-3">
                                {section.items.map((item) => (
                                    // 検索中は答えを開いた状態で出す（探している内容がすぐ読めるように）
                                    <Question key={`${item.q}-${searching}`} item={item} open={searching} />
                                ))}
                            </div>
                        </section>
                    ))
                )}

                <section className="mb-8 rounded-2xl border-2 border-line bg-field p-5">
                    <h2 className="pb-2 text-2xl font-extrabold">解決しないとき</h2>
                    <p className="text-lg font-bold">
                        {HELP_CONTACT
                            ? `次の担当者に連絡してください：${HELP_CONTACT}`
                            : 'アカウントのことは同じ班の班長か管理者に、工具の故障や紛失は管理者に連絡してください。'}
                    </p>
                </section>
            </div>
        </div>
    )
}

export default Help
