import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment } from 'react'

// 確認ダイアログ。
// 誤操作が記録の食い違いに直結するため、選択肢は大きく、左右に離して配置する。
// 「はい／いいえ」だけでなく操作名（返す・借りる等）を文言に含めて渡すこと。
const ConfirmModal = ({
    isOpen,
    setIsOpen,
    text,
    yesText,
    noText,
    setBoolean,
    borderColor = 'border-main',
    danger = false,
}) => {
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-40" onClose={() => setIsOpen(false)}>
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
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 flex items-center justify-center p-4">
                        <Dialog.Panel
                            className={`w-full max-w-xl rounded-2xl border-8 bg-surface px-8 py-8 ${borderColor}`}
                        >
                            <Dialog.Title className="text-center text-3xl font-extrabold">
                                {text}
                            </Dialog.Title>
                            <div className="mt-8 flex gap-5">
                                {/* 取り消し側を左に置き、押し間違えても危険側に寄らないようにする */}
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="min-h-touch-lg w-1/2 rounded-xl border-2 border-ink bg-surface text-xl font-extrabold text-ink"
                                >
                                    {noText}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBoolean(true)}
                                    className={`min-h-touch-lg w-1/2 rounded-xl border-2 text-xl font-extrabold text-surface ${
                                        danger ? 'border-accent bg-accent' : 'border-main bg-main'
                                    }`}
                                >
                                    {yesText}
                                </button>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Transition.Child>
            </Dialog>
        </Transition>
    )
}

export default ConfirmModal
