import React, { useState } from 'react'
import MapModal from './MapModal'
import { getMapName } from '../../utils/map'
import { publicUrl } from '../../api'

// マップの縮小表示 + タップでピン配置モーダルを開くブロック。
// 貸出・更新・デフォルト位置設定で共通して使う。
// 場所は「A5」という区画名の文字でも示し、ピンの色や位置だけに頼らない。
const MapPicker = ({ pin, setPin, label = '場所', src = publicUrl('/img/map.png') }) => {
    const [isOpen, setIsOpen] = useState(false)
    const place = getMapName(pin?.x, pin?.y)

    return (
        <div>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label={`${label}をマップから選ぶ（現在：${place ?? '未設定'}）`}
                className="relative block w-full overflow-hidden rounded-xl border-2 border-ink p-0"
            >
                <img className="block h-full w-full object-cover" src={src} alt="" aria-hidden="true" />
                {pin && (
                    <span
                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    >
                        <svg width="40" height="40" viewBox="0 0 24 24" className="drop-shadow" aria-hidden="true">
                            <path
                                d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
                                fill="#C4000F"
                                stroke="#fff"
                                strokeWidth="1.5"
                            />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                        </svg>
                    </span>
                )}
                <span className="absolute bottom-0 right-0 bg-main px-3 py-1 text-sm font-bold text-surface">
                    タップで拡大・変更
                </span>
            </button>

            <div className="mt-3 flex items-baseline gap-3 border-b-2 border-dashed border-line pb-2">
                <span className="shrink-0 text-base text-sub">{label}</span>
                <span className="text-2xl font-extrabold">{place ?? '未設定'}</span>
            </div>

            <MapModal
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                src={src}
                pin={pin}
                setPin={setPin}
            />
        </div>
    )
}

export default MapPicker
