import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment, useEffect, useState } from 'react'
import { getMapName } from '../../utils/map'
import ConfirmModal from '../Util/ConfirmModal'
import { getToolState } from '../../utils/toolState'

const DetailModal = ({ isOpen, setIsOpen }) => {
    const [pin, setPin] = useState(null)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)
    useEffect(() => {
        if (isConfirmed) {
            console.log('更新処理を実行')
            window.location.reload()
        }
    }, [isConfirmed])
    const [tool, setTool] = useState({
        name: "レンチA",
        id: "RN-0001-A",
        state: "good",
        lastInspectionDate: "2024-06-01",
        pin: { x: 30, y: 72 },
        history: [
            { start: "2024-06-01", end: "2024-06-15", user: "User A" },
            { start: "2024-05-10", end: "2024-05-20", user: "User B" },
            { start: "2024-04-01", end: "2024-04-10", user: "User C" },
            { start: "2024-03-01", end: "2024-03-10", user: "User D" },
            { start: "2024-02-01", end: "2024-02-10", user: "User E" },
            { start: "2024-01-01", end: "2024-01-10", user: "User F" },
            { start: "2023-12-01", end: "2023-12-10", user: "User G" },
            { start: "2023-11-01", end: "2023-11-10", user: "User H" },
            { start: "2023-10-01", end: "2023-10-10", user: "User I" },
            { start: "2023-09-01", end: "2023-09-10", user: "User J" },
            { start: "2023-08-01", end: "2023-08-10", user: "User K" },
            { start: "2023-07-01", end: "2023-07-10", user: "User L" },
        ]
    })

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
                                    <span className="text-lg font-semibold">工具詳細</span>
                                    <span className="text-lg">{tool.name}</span>
                                </div>

                                <div className={`flex`}>
                                    <div className="px-4 pt-4 h-120 w-5/6">
                                        <div className="relative aspect-square flex w-full justify-center h-7/12">
                                            <img className="h-64 w-64 object rounded-xl border border-main" src="img/tmp/1.jpg" alt="工具" />
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
                                                    <select name="toolState" id="toolState" value={tool.state} onChange={(e) => setToolState(e.target.value)} className="bg-base text-sm">
                                                        <option value="good">良好</option>
                                                        <option value="bad">不良</option>
                                                        <option value="broken">破損</option>
                                                    </select>
                                                </span>
                                            </div>

                                            <div className="flex items-baseline gap-3 pb-0.5">
                                                <span className="w-16 text-xs">点検日</span>
                                                <span className="font-semibold">
                                                    <input type="date" value={tool.lastInspectionDate} className="w-32 px-2 py-1 rounded-lg border border-line text-sm" />
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full flex flex-col justify-center">
                                        <div className="flex items-baseline gap-3 mt-3 pb-2.5 border-b border-dashed">
                                            <span className="w-16 text-xs">
                                                場所：
                                            </span>
                                            <span className="font-semibold">
                                                {getMapName(tool.pin?.x, tool.pin?.y)}
                                            </span>
                                        </div>
                                        <div className="gap-3 mt-3 pb-2.5 border-b border-dashed">
                                            <span className="w-16 text-xs">
                                                使用履歴
                                            </span>
                                            <div className="ml-4 border-l border-black border-dashed pl-4 max-h-80 overflow-y-auto">
                                                <ul className="flex flex-col gap-2">
                                                    {tool.history.map((h, i) => (
                                                        <li key={i} className="font-semibold">
                                                            {h.start} 〜 {h.end} : {h.user}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-4.5 pt-3.5 pb-4.5">
                                    <button onClick={() => setIsConfirmOpen(true)} className="w-full py-3.5 rounded-lg font-extrabold bg-main text-base">
                                        更新
                                    </button>
                                </div>

                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
                <ConfirmModal isOpen={isConfirmOpen} setIsOpen={setIsConfirmOpen} text="本当に更新しますか？" yesText="はい" noText="いいえ" setBoolean={setIsConfirmed} borderColor="border-main" />
            </Dialog>
        </Transition>
    )
}

export default DetailModal