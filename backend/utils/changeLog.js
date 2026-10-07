// 工具情報の更新履歴。
// 更新の前後で tools の行を比べ、変わった項目だけを「項目名・変更前・変更後」の表示用文字列で残す。
const { getMapName } = require('./map');
const { nowJst } = require('./time');

const STATE_LABELS = { good: '良好', bad: '不良' };
const DEFECT_RANK_LABELS = { minor: '軽微（使用可）', repair: '要修理', replace: '要買い替え', waiting: '交換待ち' };

const iso = (value) => (value ? String(value).slice(0, 10) : '');
const num = (value) => (value === null || value === undefined ? null : Number(value));
const placeOf = (row) =>
    row.pin_x === null || row.pin_x === undefined ? '' : getMapName(num(row.pin_x), num(row.pin_y)) ?? '';

// 比べる項目。value は比較用、display は履歴に出す文字列。
const FIELDS = [
    { label: '名前', value: (r) => r.name ?? '' },
    { label: '大項目', value: (r) => r.category ?? '' },
    { label: '写真', value: (r) => r.photo_url ?? '', display: (v) => (v ? '登録あり' : '') },
    { label: '状態', value: (r) => r.state, display: (v) => STATE_LABELS[v] ?? v },
    { label: '不良ランク', value: (r) => r.defect_rank ?? '', display: (v) => DEFECT_RANK_LABELS[v] ?? v },
    { label: '不良内容', value: (r) => r.defect_note ?? '' },
    { label: '購入日', value: (r) => iso(r.purchase_date) },
    { label: '最終点検日', value: (r) => iso(r.last_inspection_date) },
];

// 点検項目は { inspectionItems: ['外観', ...] } を行に足して渡すと比べる
const diffTool = (before, after) => {
    const changes = [];

    for (const { label, value, display = (v) => v } of FIELDS) {
        const from = value(before);
        const to = value(after);
        if (from === to) continue;
        changes.push({ label, from: display(from) || '未設定', to: display(to) || '未設定' });
    }

    // 持ち出し場所は区画名で比べる。同じ区画内でピンだけ動いたときも分かるようにする。
    const fromPlace = placeOf(before);
    const toPlace = placeOf(after);
    if (fromPlace !== toPlace) {
        changes.push({ label: '持ち出し場所', from: fromPlace || '未設定', to: toPlace || '未設定' });
    } else if (num(before.pin_x) !== num(after.pin_x) || num(before.pin_y) !== num(after.pin_y)) {
        changes.push({ label: '持ち出し場所', from: fromPlace || '未設定', to: `${toPlace || '未設定'}（位置を調整）` });
    }

    if (before.inspectionItems && after.inspectionItems) {
        const added = after.inspectionItems.filter((n) => !before.inspectionItems.includes(n));
        const removed = before.inspectionItems.filter((n) => !after.inspectionItems.includes(n));
        if (added.length || removed.length) {
            changes.push({
                label: '点検項目',
                from: before.inspectionItems.join('、') || '未設定',
                to: after.inspectionItems.join('、') || '未設定',
            });
        }
    }

    return changes;
};

const getToolRow = async (conn, toolId) => {
    const [rows] = await conn.query('SELECT * FROM tools WHERE id = ?', [toolId]);
    return rows[0] ?? null;
};

const getInspectionItemNames = async (conn, toolId) => {
    const [rows] = await conn.query(
        `SELECT i.name FROM tool_inspection_items ti
           JOIN inspection_items i ON i.id = ti.item_id
          WHERE ti.tool_id = ?
          ORDER BY i.sort_order, i.id`,
        [toolId]
    );
    return rows.map((r) => r.name);
};

const writeChangeLog = async (conn, { toolId, employeeId, source, changes }) => {
    if (!changes || changes.length === 0) return;
    await conn.query(
        `INSERT INTO tool_change_logs (tool_id, employee_id, changed_at, source, changes)
         VALUES (?, ?, ?, ?, ?)`,
        [toolId, employeeId ?? null, nowJst(), source, JSON.stringify(changes)]
    );
};

// 工具を更新する処理を前後の比較つきで実行し、変わった項目を履歴に残す。
//   await withToolChangeLog(conn, { toolId, employeeId, source }, async () => { ...UPDATE... })
const withToolChangeLog = async (conn, { toolId, employeeId, source, items = false }, update) => {
    const before = await getToolRow(conn, toolId);
    if (before && items) before.inspectionItems = await getInspectionItemNames(conn, toolId);
    const result = await update();
    const after = await getToolRow(conn, toolId);
    if (before && after) {
        if (items) after.inspectionItems = await getInspectionItemNames(conn, toolId);
        await writeChangeLog(conn, { toolId, employeeId, source, changes: diffTool(before, after) });
    }
    return result;
};

module.exports = {
    STATE_LABELS,
    DEFECT_RANK_LABELS,
    diffTool,
    writeChangeLog,
    withToolChangeLog,
    getInspectionItemNames,
};
