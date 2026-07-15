import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment, useEffect, useState } from 'react'
import MapModal from '../Util/MapModal'
import { getMapName } from '../../utils/map'
import ConfirmModal from '../Util/ConfirmModal'
import { getToolState } from '../../utils/toolState'
import { buildRentTool } from '../../utils/tools'

const RentModal = ({ isOpen, setIsOpen }) => {
    const [isMapOpen, setIsMapOpen] = useState(false)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)
    useEffect(() => {
        if (isConfirmed) {
            console.log('借りる処理を実行')
            window.location.reload()
        }
    }, [isConfirmed])
    // QR/検索で得たID（toolId）から該当する工具を読み込む
    const [tool, setTool] = useState(() => buildRentTool(toolId))
    useEffect(() => {
        if (toolId) {
            setTool(buildRentTool(toolId))
        }
    }, [toolId])

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-20" onClose={() => setIsOpen(false)}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25" />
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
                        <Dialog.Panel className="relative max-w-5xl mx-auto">
                            <div className="w-full max-w-5xl bg-base border-main border-4 rounded-2xl overflow-hidden fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3">
                                <div className={`flex items-center justify-between px-4 py-4 border-b`}>
                                    <span className="text-lg font-semibold">工具貸し出し</span>
                                    <span className="text-lg">{tool.notFound ? '該当なし' : tool.name}</span>
                                </div>

                                <div className={`flex`}>
                                    <div className="px-4 pt-4 h-120 w-5/6">
                                        <div className="relative aspect-square flex w-full justify-center h-7/12">
                                            <img className="h-64 w-64 object rounded-xl border border-main" src={tool.photoUrl || 'img/tmp/1.jpg'} alt="工具" />
                                        </div>
                                        <div className="flex flex-col gap-3 px-4.5 pt-2 pb-1.5">

                                            <div className="flex items-baseline gap-3 pb-2.5 border-b border-dashed">
                                                <span className="w-16 text-xs">名前</span>
                                                <span className="font-semibold">{tool.name}</span>
                                            </div>

                                            <div className="flex items-baseline gap-3 pb-2.5 border-b border-dashed">
                                                <span className="w-16 text-xs">ID</span>
                                                <span className="font-semibold">{tool.id}</span>
                                            </div>

                                            <div className="flex items-baseline gap-3 pb-2.5 border-b border-dashed">
                                                <span className="w-16 text-xs">状態</span>
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold">
                                                    <span className={`w-3 h-3 rounded-full ${tool.state === 'good' ? 'bg-green-500' : tool.state === 'bad' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                                                    {getToolState(tool.state)}
                                                </span>
                                            </div>

                                            <div className="flex items-baseline gap-3 pb-0.5">
                                                <span className="w-16 text-xs">期間</span>
                                                <span className="font-semibold">
                                                    <input type="date" value={tool.lastRent.start} onChange={(e) => setTool({...tool, lastRent: {...tool.lastRent, start: e.target.value}})} className="w-32 px-2 py-1 rounded-lg border border-line text-sm" />
                                                    <span className="mx-4">→</span>
                                                    <input type="date" value={tool.lastRent.end} onChange={(e) => setTool({...tool, lastRent: {...tool.lastRent, end: e.target.value}})} className="w-32 px-2 py-1 rounded-lg border border-line text-sm" />
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative aspect-square h-96 pt-4 pr-6 w-full">
                                        <div
                                            onClick={() => setIsMapOpen(true)}
                                            className="relative h-full w-full cursor-pointer overflow-hidden rounded-xl border border-main"
                                        >
                                            <img className="h-full w-full object-cover" src="img/map.png" alt="マップ" />
                                            {/* 配置済みのピンを縮小マップにも表示 */}
                                            {tool.pin && (
                                                <div
                                                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                                                    style={{ left: `${tool.pin.x}%`, top: `${tool.pin.y}%` }}
                                                >
                                                    <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow">
                                                        <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" fill="#E60012" stroke="#fff" strokeWidth="1.5" />
                                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                                    </svg>
                                                </div>
                                            )}
                                            <span className="absolute bottom-1 right-1 rounded bg-black/50 px-2 py-0.5 text-xs text-base">
                                                タップで拡大
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-3 mt-3 pb-2.5 border-b border-dashed">
                                            <span className="w-20 text-xs">
                                                場所：
                                            </span>
                                            <span className="font-semibold">
                                                {getMapName(tool.pin?.x, tool.pin?.y)}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-3 mt-3 pb-2.5 border-b border-dashed">
                                            <span className="w-20 text-xs">
                                                貸し出し予約：
                                            </span>
                                            <input type="checkbox" checked={tool.reserved} onChange={(e) => setTool({...tool, reserved: e.target.checked})} className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>

                                <div className="px-4.5 pt-3.5 pb-4.5">
                                    <button
                                        onClick={() => setIsConfirmOpen(true)}
                                        disabled={tool.notFound}
                                        className="w-full py-3.5 rounded-lg font-extrabold bg-main text-base disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {tool.notFound ? '該当する工具がありません' : '借りる'}
                                    </button>
                                </div>

                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>

                {/* マップ拡大 + ピン配置モーダル */}
                <MapModal
                    isOpen={isMapOpen}
                    setIsOpen={setIsMapOpen}
                    src="img/map.png"
                    pin={tool.pin}
                    setTool={setTool}
                />
                <ConfirmModal isOpen={isConfirmOpen} setIsOpen={setIsConfirmOpen} text="本当に借りますか？" yesText="はい" noText="いいえ" setBoolean={setIsConfirmed} borderColor="border-main" />
            </Dialog>
        </Transition>
    )
}

export default RentModal