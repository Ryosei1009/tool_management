// モーダル内の「項目名 + 値」の1行
const InfoRow = ({ label, children }) => (
    <div className="flex items-baseline gap-4 border-b-2 border-dashed border-line pb-3">
        <span className="w-24 shrink-0 text-base text-sub">{label}</span>
        <span className="min-w-0 text-2xl font-extrabold">{children}</span>
    </div>
)

export default InfoRow
