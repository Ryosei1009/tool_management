// 期間が他の予約・貸出と重なっているときの警告。
// 押してから失敗するのではなく、入力した時点で何と重なっているかを見せる。
const ConflictAlert = ({ conflicts }) => {
    if (!conflicts || conflicts.length === 0) return null
    return (
        <div role="alert" className="rounded-xl border-4 border-accent bg-surface p-4">
            <p className="flex items-center gap-2 text-lg font-extrabold text-accent">
                <span aria-hidden="true">✕</span>
                期間が他の予約・貸出と重なっています
            </p>
            <ul className="mt-2 flex flex-col gap-1">
                {conflicts.map((c) => (
                    <li key={c.rentalId} className="text-lg font-bold">
                        <span className="mr-2 text-base text-sub">{c.renting ? '貸出中' : '予約'}</span>
                        {c.label}
                        <span className="ml-2 font-medium text-sub">{c.user}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-2 text-base text-sub">期間を変えてください。</p>
        </div>
    )
}

export default ConflictAlert
