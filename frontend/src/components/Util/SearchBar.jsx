import React from 'react'

// 一覧画面共通の検索バー。
// 手袋でも押せる高さを確保し、入力欄には必ずラベル（読み上げ用）とプレースホルダを付ける。
// 入力済みのときは大きな消去ボタンを出して、片手でもやり直せるようにする。
//
// label="" を渡すとラベルは画面上に出さないが、読み上げ用の名前は必ず残す
// （見出しで意味が分かる場所では表示を省きたいが、名前が無いと音声では何の入力欄か分からないため）。
const SearchBar = ({
    keyword,
    onChange,
    label = '検索',
    placeholder = '名前 / ID で検索',
    srLabel,
}) => (
    <div className="mb-6">
        <label
            htmlFor="search"
            className={
                label ? 'mb-2 block text-base font-bold text-sub' : 'sr-only'
            }
        >
            {label || srLabel || placeholder}
        </label>
        <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border-2 border-ink bg-surface px-4">
                <svg
                    className="h-8 w-8 shrink-0 text-ink"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
                </svg>
                <input
                    id="search"
                    type="search"
                    value={keyword}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="min-w-0 flex-1 border-0 bg-transparent text-lg font-bold outline-none placeholder:font-normal placeholder:text-sub"
                />
            </div>
            {keyword && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="min-h-touch shrink-0 rounded-xl border-2 border-ink px-5 text-lg font-extrabold"
                >
                    消去
                </button>
            )}
        </div>
    </div>
)

export default SearchBar
