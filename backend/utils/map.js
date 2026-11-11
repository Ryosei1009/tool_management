// マップ（持ち出し場所）の設定。
// 区画は { name, x0, y0, x1, y1 }（マップ画像に対する 0〜100 の割合）の一覧で持ち、
// ピンの座標がどの区画に入るかで持ち出し場所の名前を決める。
// 設定は app_settings の 'map' に JSON で保存し、管理画面（マップの設定）から変更する。
// フロントの src/utils/map.js も同じ判定をする（区画の一覧は /settings/map で渡す）。

// 設定を一度も保存していないときの区画（従来の A1〜A9）
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
];

const DEFAULT_CONFIG = { imageUrl: null, rows: null, cols: null, regions: DEFAULT_REGIONS };

const MAX_GRID = 10;
const CACHE_MS = 30 * 1000;

let config = DEFAULT_CONFIG;
let loadedAt = 0;

// 下端・右端（100）は含める。それ以外は「以上・未満」で、隣の区画と重ならないようにする。
const inRange = (v, from, to) => v >= from && (v < to || (to >= 100 && v <= 100));

const findRegion = (regions, x, y) => {
    if (x === null || x === undefined || y === null || y === undefined) return null;
    const nx = Number(x);
    const ny = Number(y);
    if (Number.isNaN(nx) || Number.isNaN(ny)) return null;
    return regions.find((r) => inRange(nx, r.x0, r.x1) && inRange(ny, r.y0, r.y1))?.name ?? null;
};

// ピン座標（%）から区画名を返す
const getMapName = (x, y) => findRegion(config.regions, x, y);

// 縦 rows × 横 cols の均等な区画を作る。names は左上から右へ、上から下への順。
// 名前が空の区画は「A1」（行のアルファベット + 列の番号）にする。
const buildGrid = (rows, cols, names = []) => {
    const regions = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const i = r * cols + c;
            regions.push({
                name: String(names[i] ?? '').trim() || `${String.fromCharCode(65 + r)}${c + 1}`,
                x0: (c * 100) / cols,
                y0: (r * 100) / rows,
                x1: ((c + 1) * 100) / cols,
                y1: ((r + 1) * 100) / rows,
            });
        }
    }
    return regions;
};

const getMapConfig = () => config;

// DB から読み直す。読めなければ今の設定のまま使う。
const loadMapConfig = async (db, { force = false } = {}) => {
    if (!force && Date.now() - loadedAt < CACHE_MS) return config;
    try {
        const [rows] = await db.query("SELECT value FROM app_settings WHERE name = 'map'");
        const saved = rows[0] ? JSON.parse(rows[0].value) : null;
        config =
            saved && Array.isArray(saved.regions) && saved.regions.length > 0
                ? { ...DEFAULT_CONFIG, ...saved }
                : DEFAULT_CONFIG;
        loadedAt = Date.now();
    } catch (err) {
        console.error('マップの設定を読み込めませんでした:', err.message);
    }
    return config;
};

const saveMapConfig = async (db, next) => {
    await db.query(
        `INSERT INTO app_settings (name, value) VALUES ('map', ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [JSON.stringify(next)]
    );
    config = next;
    loadedAt = Date.now();
    return config;
};

module.exports = {
    DEFAULT_CONFIG,
    DEFAULT_REGIONS,
    MAX_GRID,
    findRegion,
    getMapName,
    buildGrid,
    getMapConfig,
    loadMapConfig,
    saveMapConfig,
};
