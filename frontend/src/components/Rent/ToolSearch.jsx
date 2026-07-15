import React, { useState } from 'react'
import { sampleTools } from '../../data/sampleData'

// 借りる画面 右半分：工具を検索して選ぶ画面
// QRリーダーと同様に、選択すると setResult を呼んで貸出入力へ進む
const ToolSearch = ({ setResult, tools = sampleTools }) => {
  const [keyword, setKeyword] = useState('')

  const filtered = keyword
    ? tools.filter((t) =>
        [t.name, t.id, t.place].some((v) => (v ?? '').toString().includes(keyword))
      )
    : tools

  return (
    <div className="flex h-full flex-col items-center gap-4 px-6 pt-8">
      {/* 検索バー */}
      <div className="flex w-full max-w-md items-center gap-3">
        <div className="flex flex-1 items-center rounded-lg border border-line bg-base px-4 py-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="工具名 / ID で検索"
            className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-sub/60"
          />
          {/* 虫眼鏡アイコン */}
          <svg
            className="h-6 w-6 shrink-0 text-main"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* 検索結果リスト */}
      <div className="max-h-[65vh] flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="pt-8 text-center text-sub font-semibold">
            該当する工具がありません
          </p>
        ) : (
          filtered.map((tool, i) => (
            <button
              key={tool.id ?? i}
              type="button"
              onClick={() => setResult(tool.id ?? tool.name)}
              className="flex items-center gap-4 rounded-2xl border border-line bg-base px-4 py-3 text-left"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-base">
                {tool.photoUrl && (
                  <img
                    src={tool.photoUrl}
                    alt={tool.name || 'アイコン'}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="w-10 text-xs">名前</span>
                  <span className="font-semibold truncate">{tool.name || '○○'}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="w-10 text-xs">ID</span>
                  <span className="font-semibold truncate">{tool.id ?? '―'}</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="w-10 text-xs">場所</span>
                  <span className="font-semibold truncate">{tool.place || '―'}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default ToolSearch
