const { getMapName } = require('./map');

// フロントの表示に合わせた「1月2日」形式
const toJpDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
};

// YYYY-MM-DD（<input type="date"> がそのまま扱える形式）
const toIsoDate = (value) => {
    if (!value) return '';
    return String(value).slice(0, 10);
};

// DECIMAL 列の組を { x, y } に変換する（未設定なら null）
const toPin = (x, y) =>
    x === null || x === undefined || y === null || y === undefined
        ? null
        : { x: Number(x), y: Number(y) };

// tools テーブルの1行をフロントの工具オブジェクトへ変換する
const toToolResponse = (row) => {
    const pin = toPin(row.pin_x, row.pin_y);

    return {
        id: row.id,
        name: row.name,
        category: row.category,
        photoUrl: row.photo_url,
        state: row.state,
        pin,
        place: pin ? getMapName(pin.x, pin.y) : null,
        lastInspectionDate: toIsoDate(row.last_inspection_date),
        // 貸出中の場合のみ入る（JOIN したときの列）
        user: row.user_name ?? '',
        userId: row.user_id ?? null,
        rentalId: row.rental_id ?? null,
        startDate: toJpDate(row.start_date),
        endDate: toJpDate(row.end_date),
        rentStart: toIsoDate(row.start_date),
        rentEnd: toIsoDate(row.end_date),
        reserved: row.reserved === undefined || row.reserved === null ? false : Boolean(row.reserved),
        isRented: Boolean(row.rental_id),
    };
};

// employees テーブルの1行をフロントの社員オブジェクトへ変換する
const toEmployeeResponse = (row) => {
    // 工具を借りるときの既定の置き場所（未設定なら null）
    const defaultPin = toPin(row.default_pin_x, row.default_pin_y);

    return {
        id: row.id,
        name: row.name,
        team: row.team,
        bloodType: row.blood_type,
        permission: row.permission,
        photoUrl: row.photo_url,
        defaultPin,
        defaultPlace: defaultPin ? getMapName(defaultPin.x, defaultPin.y) : null,
    };
};

module.exports = { toJpDate, toIsoDate, toToolResponse, toEmployeeResponse, toPin };
