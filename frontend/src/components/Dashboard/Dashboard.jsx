import { useCallback, useState } from 'react'
import PageTitle from '../Util/PageTitle'
import Button from '../Util/Button'
import DefectRankBadge from '../Util/DefectRankBadge'
import DetailModal from '../ToolList/DetailModal'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'
import { fetchDashboard, unlockEmployee } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { useAuth } from '../../auth/AuthContext'
import { canSeeDashboard, isAdmin } from '../../utils/roles'
import { getDueInfo } from '../../utils/period'
import { getCategories } from '../../utils/toolInfo'

const Label = ({ children }) => <span className="mr-2 text-base font-medium text-sub">{children}</span>

// 見出しに件数を付ける。対応が必要なもの（件数 > 0）は色に加えて ✕ / ▲ でも示す。
// level='info' は件数だけを出す（対応が要るわけではない一覧）。
const Section = ({ title, count, level = 'danger', empty, children }) => (
    <section className="mb-8">
        <h2 className="flex flex-wrap items-center gap-3 pb-3 text-2xl font-extrabold">
            <span className="h-7 w-1.5 shrink-0 rounded bg-steel" aria-hidden="true" />
            {title}
            <span
                className={`rounded-full border-2 px-3 py-0.5 text-lg ${
                    level === 'info'
                        ? 'border-ink text-ink'
                        : count === 0
                          ? 'border-state-good text-state-good'
                          : level === 'danger'
                            ? 'border-accent bg-accent text-surface'
                            : 'border-state-bad text-state-bad'
                }`}
            >
                {level !== 'info' && (
                    <span aria-hidden="true" className="mr-1">
                        {count === 0 ? '●' : level === 'danger' ? '✕' : '▲'}
                    </span>
                )}
                {count} 件
            </span>
        </h2>
        {count === 0 ? (
            <p className="rounded-xl border-2 border-line bg-field p-4 text-lg font-bold text-sub">{empty}</p>
        ) : (
            <ul className="flex flex-col gap-3">{children}</ul>
        )}
    </section>
)

// 1件分の行。押すと工具の詳細を開く。
const ToolRow = ({ tool, onSelect, children }) => (
    <li>
        <button
            type="button"
            onClick={() => onSelect(tool.id)}
            className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 rounded-2xl border-2 border-ink bg-surface px-4 py-3 text-left"
        >
            <span className="text-xl font-extrabold">{tool.name}</span>
            <span className="text-lg font-bold">
                <Label>ID</Label>
                {tool.id}
            </span>
            {children}
        </button>
    </li>
)

const RentalRows = ({ rentals, onSelect }) =>
    rentals.map((t) => {
        const due = getDueInfo(t.rentEnd, t.rentEndPeriod)
        return (
            <ToolRow key={t.rentalId} tool={t} onSelect={onSelect}>
                <span className="text-lg font-bold">
                    <Label>使用者</Label>
                    {t.user}
                    {t.userTeam && <span className="ml-2 text-base text-sub">（{t.userTeam}）</span>}
                </span>
                <span className="text-lg font-bold">
                    <Label>返却予定</Label>
                    {t.endDate}
                </span>
                {due && (
                    <span className={`w-full text-lg font-extrabold ${due.urgent ? 'text-accent' : 'text-state-bad'}`}>
                        <span aria-hidden="true" className="mr-1">
                            {due.urgent ? '✕' : '▲'}
                        </span>
                        {due.label}
                    </span>
                )}
            </ToolRow>
        )
    })

const InspectionRows = ({ tools, onSelect }) =>
    tools.map((t) => (
        <ToolRow key={t.id} tool={t} onSelect={onSelect}>
            <span className="text-lg font-bold">
                <Label>最終点検日</Label>
                {t.lastInspectionDate ? t.lastInspectionDate.replace(/-/g, '/') : '未点検'}
            </span>
            <span className="text-lg font-bold">
                <Label>次回点検日</Label>
                {t.inspection.nextDate ? t.inspection.nextDate.replace(/-/g, '/') : '―'}
                {t.inspection.daysLeft !== null && (
                    <span className="ml-2 text-base text-sub">
                        （{t.inspection.daysLeft < 0 ? `${-t.inspection.daysLeft} 日超過` : `あと ${t.inspection.daysLeft} 日`}）
                    </span>
                )}
            </span>
            <span className="text-lg font-bold">
                <Label>周期</Label>
                {t.inspection.intervalMonths}か月ごと
            </span>
        </ToolRow>
    ))

// 管理者・班長向けの一覧。対応が必要なものを上から順に並べる。
//   管理者 … 全体（返却遅れ・点検期限・不良の工具・ロック中の社員・貸出中の一覧）
//   班長   … 自分の班（返却遅れ・ロック中の社員・貸出中の一覧）
const Dashboard = () => {
    const { user } = useAuth()
    const allowed = canSeeDashboard(user)
    const admin = isAdmin(user)

    const load = useCallback(() => fetchDashboard(), [])
    const { data, loading, error, reload } = useFetch(load, { enabled: allowed })
    const [selectedId, setSelectedId] = useState(null)
    const [busy, setBusy] = useState(false)
    const [actionError, setActionError] = useState('')
    const [message, setMessage] = useState('')

    const unlock = async (employee) => {
        setBusy(true)
        setActionError('')
        setMessage('')
        try {
            await unlockEmployee(employee.id)
            setMessage(`${employee.name} のロックを解除しました。`)
            reload()
        } catch (err) {
            setActionError(err.message)
        } finally {
            setBusy(false)
        }
    }

    if (!allowed) {
        return (
            <div className="px-6 pt-8 pb-nav">
                <Empty>この画面は管理者・班長のみ利用できます</Empty>
            </div>
        )
    }

    const rentals = data?.rentals ?? []
    const onTime = rentals.filter((t) => !t.isOverdue)

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-6">
                <PageTitle
                    en="DASHBOARD"
                    description={
                        admin
                            ? '対応が必要なものを上から順に表示しています。行を押すと工具の詳細を開きます。'
                            : `${data?.team ?? '自分の班'} のメンバーの貸出状況です。行を押すと工具の詳細を開きます。`
                    }
                >
                    管理ダッシュボード
                </PageTitle>

                {message && (
                    <p role="status" className="pb-4 text-lg font-bold text-state-good">
                        {message}
                    </p>
                )}
                {actionError && (
                    <p role="alert" className="pb-4 text-lg font-bold text-accent">
                        ✕ {actionError}
                    </p>
                )}

                {loading && !data ? (
                    <Loading />
                ) : error && !data ? (
                    <ErrorMessage message={error} onRetry={reload} />
                ) : (
                    <>
                        <Section
                            title="返却予定を過ぎている貸出"
                            count={data.overdueRentals.length}
                            empty="返却遅れはありません。"
                        >
                            <RentalRows rentals={data.overdueRentals} onSelect={setSelectedId} />
                        </Section>

                        {admin && (
                            <>
                                <Section
                                    title="点検期限が切れている工具"
                                    count={data.inspectionOverdue.length}
                                    empty="点検期限が切れている工具はありません。"
                                >
                                    <InspectionRows tools={data.inspectionOverdue} onSelect={setSelectedId} />
                                </Section>

                                <Section
                                    title="30日以内に点検期限を迎える工具"
                                    count={data.inspectionSoon.length}
                                    level="warn"
                                    empty="30日以内に点検期限を迎える工具はありません。"
                                >
                                    <InspectionRows tools={data.inspectionSoon} onSelect={setSelectedId} />
                                </Section>

                                <Section
                                    title="不良の工具"
                                    count={data.defects.length}
                                    level="warn"
                                    empty="不良の工具はありません。"
                                >
                                    {data.defects.map((t) => (
                                        <ToolRow key={t.id} tool={t} onSelect={setSelectedId}>
                                            <DefectRankBadge rank={t.defectRank} />
                                            {t.defectNote && (
                                                <span className="w-full text-lg font-bold text-sub">{t.defectNote}</span>
                                            )}
                                        </ToolRow>
                                    ))}
                                </Section>
                            </>
                        )}

                        <Section
                            title="ログインがロックされている社員"
                            count={data.lockedEmployees.length}
                            level="warn"
                            empty="ロックされている社員はいません。"
                        >
                            {data.lockedEmployees.map((e) => (
                                <li
                                    key={e.id}
                                    className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border-2 border-ink bg-surface px-4 py-3"
                                >
                                    <span className="text-xl font-extrabold">{e.name}</span>
                                    <span className="text-lg font-bold">
                                        <Label>社員ID</Label>
                                        {e.id}
                                    </span>
                                    <span className="min-w-40 flex-1 text-lg font-bold">
                                        <Label>自動で解除</Label>
                                        {e.lockedUntil}
                                    </span>
                                    <Button size="md" variant="secondary" disabled={busy} onClick={() => unlock(e)}>
                                        ロックを解除
                                    </Button>
                                </li>
                            ))}
                        </Section>

                        <Section
                            title={admin ? '貸出中の工具（期限内）' : '班のメンバーが借りている工具（期限内）'}
                            count={onTime.length}
                            level="info"
                            empty="期限内の貸出はありません。"
                        >
                            <RentalRows rentals={onTime} onSelect={setSelectedId} />
                        </Section>
                    </>
                )}
            </div>

            <DetailModal
                isOpen={selectedId !== null}
                setIsOpen={(open) => !open && setSelectedId(null)}
                toolId={selectedId}
                categories={getCategories([...(data?.defects ?? []), ...rentals])}
                onUpdated={reload}
            />
        </div>
    )
}

export default Dashboard
