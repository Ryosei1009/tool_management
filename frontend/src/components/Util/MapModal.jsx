import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment } from 'react'
import { getMapName } from '../../utils/map'

// マップ拡大モーダル。画像をタップするとその位置にピンを立てられる。
// pin / setPin は { x, y }（画像に対する 0〜100 の割合）で管理する。
const MapModal = ({ isOpen, setIsOpen, src = '/img/map.png', pin, setPin }) => {
    // タップ位置を画像サイズに対する割合に変換してピンを立てる
    const handleClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        setPin({ x, y })
    }

    const place = getMapName(pin?.x, pin?.y)

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
                    <div className="fixed inset-0 bg-black/60" />
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
                        <Dialog.Panel className="relative mx-auto max-h-full overflow-y-auto rounded-2xl border-4 border-main bg-surface p-4">
                            <div className="mb-3 flex items-center justify-between gap-6">
                                <Dialog.Title className="text-2xl font-extrabold">
                                    置き場所を選ぶ
                                </Dialog.Title>
                                {/* 選択中の区画を文字で示す（ピンの位置だけに頼らない） */}
                                <p className="text-xl font-extrabold">
                                    <span className="mr-2 text-base font-bold text-sub">選択中</span>
                                    {place ?? '未選択'}
                                </p>
                            </div>

                            {/* マップ本体：タップでピンを立てる */}
                            <div
                                onClick={handleClick}
                                className="relative cursor-crosshair overflow-hidden rounded-xl border-2 border-ink"
                            >
                                <img
                                    src={src}
                                    alt="工場のマップ。タップして置き場所を選びます。"
                                    draggable={false}
                                    className="block max-h-[60vh] max-w-[85vw] select-none object-contain"
                                />

                                {pin && (
                                    <div
                                        className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                                        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                                    >
                                        <svg width="48" height="48" viewBox="0 0 24 24" className="drop-shadow" aria-hidden="true">
                                            <path
                                                d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
                                                fill="#C4000F"
                                                stroke="#fff"
                                                strokeWidth="1.5"
                                            />
                                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <p className="pt-3 text-center text-lg font-bold text-sub">
                                マップをタップして置き場所を選んでください
                            </p>

                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="mt-3 min-h-touch-lg w-full rounded-xl border-2 border-main bg-main px-8 text-xl font-extrabold text-surface"
                            >
                                決定して閉じる
                            </button>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    )
}

export default MapModal
