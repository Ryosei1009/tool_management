// マップ（持ち出し場所）の設定。backend の utils/map.js と同じ判定をする。
// 区画は { name, x0, y0, x1, y1 }（マップ画像に対する 0〜100 の割合）の一覧で、
// 管理画面（マップの設定）で変更できる。ログイン時に /settings/map から読み込む。

// 設定を読み込む前・一度も保存していないときの区画（従来の A1〜A9）
const DEFAULT_REGIONS = [
    { name: 'A1', x0: 0, y0: 0, x1: 38.94354952265509, y1: 35.44580756532781 },
    { name: 'A2', x0: 0, y0: 35.44580756532781, x1: 38.94354952265509, y1: 59.757463803209234 },
    { name: 'A3', x0: 0, y0: 59.757463803209234, x1: 32.5172614380738, y1: 100 },
    { name: 'A4', x0: 38.94354952265509, y0: 0, x1: 54.854700422367785, y1: 35.44580756532781 },
    { name: 'A5', x0: 38.94354952265509, y0: 35.44580756532781, x1: 58.415741419863934, y1: 59.757463803209234 },
    { name: 'A6', x0: 32.5172614380738, y0: 59.757463803209234, x1: 58.415741419863934, y1: 100 },
    { name: 'A7', x0: 54.854700422367785, y0: 0, x1: 100, y1: 35.44580756532781 },
    { name: 'A8', x0: 58.415741419863934, y0: 35.44580756532781, x1: 100, y1: 61.90216119216665 },
    { name: 'A9', x0: 58.415741419863934, y0: 61.90216119216665, x1: 100, y1: 100 },
]

export const DEFAULT_MAP_IMAGE = '/img/map.png'
export const MAX_GRID = 10

let config = { imageUrl: null, rows: null, cols: null, regions: DEFAULT_REGIONS }

export const setMapConfig = (next) => {
    if (next && Array.isArray(next.regions) && next.regions.length > 0) config = next
}

export const getMapConfig = () => config

// マップ画像のパス（resolveImageUrl に渡す）。未設定なら初期の画像。
export const getMapImage = () => config.imageUrl || DEFAULT_MAP_IMAGE

// 下端・右端（100）は含める。それ以外は「以上・未満」で、隣の区画と重ならないようにする。
const inRange = (v, from, to) => v >= from && (v < to || (to >= 100 && v <= 100))

export const findRegion = (regions, x, y) => {
    if (x === null || x === undefined || y === null || y === undefined) return undefined
    return regions.find((r) => inRange(x, r.x0, r.x1) && inRange(y, r.y0, r.y1))?.name
}

// ピン座標（%）から区画名を返す（区画の外・未設定なら undefined）
export const getMapName = (x, y) => findRegion(config.regions, x, y)

// 縦 rows × 横 cols の均等な区画。名前が空の区画は「A1」（行のアルファベット + 列の番号）。
export const defaultRegionName = (index, cols) =>
    `${String.fromCharCode(65 + Math.floor(index / cols))}${(index % cols) + 1}`

export const buildGrid = (rows, cols, names = []) =>
    Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols)
        const c = i % cols
        return {
            name: String(names[i] ?? '').trim() || defaultRegionName(i, cols),
            x0: (c * 100) / cols,
            y0: (r * 100) / rows,
            x1: ((c + 1) * 100) / cols,
            y1: ((r + 1) * 100) / rows,
        }
    })
