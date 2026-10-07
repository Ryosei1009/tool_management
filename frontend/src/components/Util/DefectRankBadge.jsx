import { getDefectRank } from '../../utils/toolInfo'

// 不良ランクの表示。買い替えの判断に使うので、重いほど目立たせる。
// 色だけに頼らず、アイコンと文字を必ず併記する。
const STYLES = {
    minor: { className: 'border-2 border-state-bad text-state-bad', icon: '△' },
    repair: { className: 'border-2 border-state-bad bg-state-bad text-surface', icon: '▲' },
    replace: { className: 'border-2 border-accent bg-accent text-surface', icon: '✕' },
    waiting: { className: 'border-2 border-steel bg-steel text-surface', icon: '↻' },
}

const DefectRankBadge = ({ rank, size = 'md' }) => {
    const info = getDefectRank(rank)
    if (!info) return null
    const { className, icon } = STYLES[rank]
    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full font-bold ${className} ${
                size === 'lg' ? 'px-4 py-1.5 text-lg' : 'px-3 py-1'
            }`}
        >
            <span aria-hidden="true">{icon}</span>
            <span className="sr-only">不良ランク：</span>
            {size === 'lg' ? info.label : info.short}
        </span>
    )
}

export default DefectRankBadge
