const { getMapName } = require('./map');
const { toJpDate, toJpSlot, toJpDateTime, todayJst, currentSlot, slotKey } = require('./time');
const { inspectionInfo } = require('./inspection');

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

// tools テーブルの1行（貸出を JOIN したもの）をフロントの工具オブジェクトへ変換する
const toToolResponse = (row) => {
    const pin = toPin(row.pin_x, row.pin_y);
    const rentalStatus = row.rental_id ? (row.rental_status ?? 'renting') : null;
    const inspection = inspectionInfo(row, todayJst());
    // 貸出中で、返却予定の半日枠を過ぎている
    const now = currentSlot();
    const isOverdue =
        rentalStatus === 'renting' &&
        Boolean(row.end_date) &&
        slotKey(row.end_date, row.end_period) < slotKey(now.date, now.period);

    return {
        id: row.id,
        name: row.name,
        category: row.category,
        photoUrl: row.photo_url,
        state: row.state,
        defectRank: row.defect_rank ?? null,
        defectNote: row.defect_note ?? '',
        pin,
        // 持ち出し場所（マップの区画名）
        place: pin ? getMapName(pin.x, pin.y) : null,
        purchaseDate: toIsoDate(row.purchase_date),
        lastInspectionDate: toIsoDate(row.last_inspection_date),
        // 点検の周期（月）。inspectionIntervalMonths は設定値（未設定は null）、
        // inspection は実際に使う周期・次回点検日・状態（none / ok / soon / overdue）
        inspectionIntervalMonths: row.inspection_interval_months ?? null,
        inspection,
        // 無効化（廃棄など）した工具は false。一覧には出ず、貸出・予約もできない
        active: row.active === undefined ? true : Boolean(row.active),
        // 貸出（または予約）の情報。JOIN したときだけ入る
        user: row.user_name ?? '',
        userId: row.user_id ?? null,
        userTeam: row.user_team ?? null,
        rentalId: row.rental_id ?? null,
        rentalStatus,
        // 表示用（「10月7日 午後」）
        startDate: toJpSlot(row.start_date, row.start_period),
        endDate: toJpSlot(row.end_date, row.end_period),
        // 入力欄用（YYYY-MM-DD と am / pm）
        rentStart: toIsoDate(row.start_date),
        rentStartPeriod: row.start_period ?? null,
        rentEnd: toIsoDate(row.end_date),
        rentEndPeriod: row.end_period ?? null,
        // 実際に持ち出した日時（「10月7日 9:05」）と、操作した人（代理なら借りる人と異なる）
        takenAt: toJpDateTime(row.taken_at),
        takenById: row.taken_by ?? null,
        takenBy: row.taken_by_name ?? null,
        isRented: rentalStatus === 'renting',
        isOverdue,
        isReserved: rentalStatus === 'reserved',
    };
};

// 予約・貸出の期間の表示（「10月7日 午前 〜 10月9日 午後」）
const toRangeLabel = (row) =>
    `${toJpSlot(row.start_date, row.start_period)} 〜 ${toJpSlot(row.end_date, row.end_period)}`;

// employees テーブルの1行をフロントの社員オブジェクトへ変換する
const toEmployeeResponse = (row) => {
    // 工具を借りるときの既定の持ち出し場所（未設定なら null）
    const defaultPin = toPin(row.default_pin_x, row.default_pin_y);

    return {
        id: row.id,
        name: row.name,
        team: row.team,
        bloodType: row.blood_type,
        permission: row.permission,
        photoUrl: row.photo_url,
        active: row.active === undefined ? true : Boolean(row.active),
        mustChangePassword: Boolean(row.must_change_password),
        defaultPin,
        defaultPlace: defaultPin ? getMapName(defaultPin.x, defaultPin.y) : null,
    };
};

module.exports = { toJpDate, toIsoDate, toToolResponse, toEmployeeResponse, toPin, toRangeLabel };
