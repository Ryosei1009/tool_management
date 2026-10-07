// 検索用の文字列の正規化（backend の utils/search.js と同じ）。
// ・全角/半角の英数字・カタカナ・記号の違いをなくす（NFKC）
// ・大文字/小文字、ひらがな/カタカナの違いをなくす（「ぺんち」で「ペンチ」が見つかる）
// ・空白を取り除く（「山田太郎」で「山田 太郎」が見つかる）
export const normalize = (value) =>
    String(value ?? '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
        .replace(/\s+/g, '')

// keyword を空白で区切った語がすべて、values のどれかに含まれていれば一致
export const matchesKeyword = (keyword, values) => {
    const words = String(keyword ?? '')
        .normalize('NFKC')
        .split(/\s+/)
        .map(normalize)
        .filter(Boolean)
    if (words.length === 0) return true
    const targets = values.map(normalize)
    return words.every((w) => targets.some((t) => t.includes(w)))
}
