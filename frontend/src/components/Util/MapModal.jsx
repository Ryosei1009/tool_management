import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment } from 'react'

// マップ拡大モーダル。画像をクリックするとその位置にピンを立てられる。
// pin / setPin は { x, y }（画像に対する 0〜100 の割合）で管理する。
const MapModal = ({ isOpen, setIsOpen, src = 'img/map.png', pin, setTool }) => {
    // クリック位置を画像サイズに対する割合に変換してピンを立てる
    const handleClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        setTool(prev => ({ ...prev, pin: { x, y } }))
        console.log(x, y)
    }

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-30" onClose={() => setIsOpen(false)}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/40" />
                </Transition.Child>
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="relative mx-auto">
                            {/* 閉じるボタン */}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="閉じる"
                                className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-main text-base font-bold shadow"
                            >
                                ✕
                            </button>

                            {/* マップ本体：クリックでピンを立てる */}
                            <div
                                onClick={handleClick}
                                className="relative cursor-crosshair overflow-hidden rounded-2xl border-accent border-8 bg-base"
                            >
                                <img
                                    src={src}
                                    alt="マップ"
                                    draggable={false}
                                    className="block max-h-[80vh] max-w-[80vw] select-none object-contain"
                                />

                                {/* ピン */}
                                {pin && (
                                    <div
                                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                                        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                                    >
                                        <svg width="32" height="32" viewBox="0 0 24 24" className="drop-shadow">
                                            <path
                                                d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
                                                fill="#E60012"
                                                stroke="#fff"
                                                strokeWidth="1.5"
                                            />
                                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <p className="pt-2 text-center text-sm font-semibold text-base">
                                マップをタップしてピンを配置
                            </p>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    )
}

export default MapModal
