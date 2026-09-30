// 工具の状態。値は backend の tools.state（ENUM）と一致させる。
export const TOOL_STATES = [
    { value: 'good', label: '良好' },
    { value: 'bad', label: '不良' },
    { value: 'damaged', label: '破損' },
]

export const getToolState = (state) =>
    TOOL_STATES.find((s) => s.value === state)?.label ?? '不明'
