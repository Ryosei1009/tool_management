import React from 'react'
import { getToolState } from '../../utils/toolState'

// 工具の状態表示。
// 色覚特性によらず判別できるよう、色・アイコン・文字の3つで冗長に伝える。
// 赤と緑の対比は避け、良好=青 / 不良=橙 / 破損=赤 とする。
const STATES = {
    good: { color: 'var(--color-state-good)', icon: '●' },
    bad: { color: 'var(--color-state-bad)', icon: '▲' },
    damaged: { color: 'var(--color-state-damaged)', icon: '✕' },
}

const getStateStyle = (state) => STATES[state] ?? STATES.good

const StateBadge = ({ state, size = 'md' }) => {
    const { color, icon } = getStateStyle(state)
    const label = getToolState(state)

    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full border-2 font-bold ${
                size === 'lg' ? 'px-4 py-1.5 text-lg' : 'px-3 py-1'
            }`}
            style={{ color, borderColor: color }}
        >
            <span aria-hidden="true">{icon}</span>
            {/* 「状態：良好」と読み上げられるようにする */}
            <span className="sr-only">状態：</span>
            {label}
        </span>
    )
}

export default StateBadge
