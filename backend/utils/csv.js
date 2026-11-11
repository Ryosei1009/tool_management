// CSV の読み書き（外部ライブラリなし）。
// ・出力は UTF-8（BOM つき）+ CRLF。Excel でそのまま開ける。
// ・入力は UTF-8 と Shift_JIS（日本語版 Excel の「CSV」保存）の両方を受け付ける。

const BOM = '﻿';

// Excel が式として実行してしまう先頭文字（= + - @ など）は ' を付けて文字として扱わせる
const neutralize = (text) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

const escapeCell = (value) => {
    const text = neutralize(value === null || value === undefined ? '' : String(value));
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// headers: ['工具ID', ...] / rows: [[...], ...]
const toCsv = (headers, rows) =>
    BOM + [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';

// バイト列を文字列にする。UTF-8 として正しくなければ Shift_JIS とみなす。
const decode = (buffer) => {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder('shift_jis').decode(buffer);
    }
};

// CSV の文字列を行の配列（各行はセルの配列）にする。"" で囲んだ中の改行・カンマ・"" に対応。
const parseCsv = (input) => {
    const text = String(input ?? '').replace(/^﻿/, '');
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                cell += ch;
            }
        } else if (ch === '"' && cell === '') {
            quoted = true;
        } else if (ch === ',') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i += 1;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += ch;
        }
    }
    if (cell !== '' || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    // 空行（全部のセルが空）は読み飛ばす
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
};

// 1行目を見出しとして、{ 見出し: 値 } の配列にする。line は元ファイルでの行番号（見出しが1行目）。
// 出力時に付けた ' は外す。
const parseTable = (buffer) => {
    const rows = parseCsv(Buffer.isBuffer(buffer) ? decode(buffer) : buffer);
    if (rows.length === 0) return { headers: [], records: [] };
    const headers = rows[0].map((h) => h.trim());
    const records = rows.slice(1).map((cells, i) => {
        const record = { line: i + 2 };
        headers.forEach((h, c) => {
            const value = (cells[c] ?? '').trim();
            record[h] = /^'[=+\-@]/.test(value) ? value.slice(1) : value;
        });
        return record;
    });
    return { headers, records };
};

// 日付のセルを YYYY-MM-DD にする（2026/4/1・2026-04-01・2026年4月1日）。空は ''、読めなければ null。
const toIsoDateCell = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const m = /^(\d{4})[/\-年.](\d{1,2})[/\-月.](\d{1,2})日?$/.exec(text);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

module.exports = { toCsv, parseCsv, parseTable, decode, toIsoDateCell, escapeCell };
