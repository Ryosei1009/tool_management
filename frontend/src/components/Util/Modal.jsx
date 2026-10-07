import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment } from 'react'

// 全画面共通のモーダル外枠。
// ・見出しは必ず Dialog.Title にして読み上げ順を整える
// ・閉じるボタンは文字入りで大きく（アイコンだけの ✕ は意味が伝わりにくい）
// ・内容が長くなっても本文側だけスクロールし、操作ボタンは下端に固定する
const Modal = ({ isOpen, setIsOpen, title, subtitle, footer, children, maxWidth = 'max-w-5xl' }) => (
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
                    <Dialog.Panel
                        className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border-4 border-main bg-surface`}
                    >
                        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 bg-main px-5 py-3">
                            <div className="flex flex-wrap items-baseline gap-4">
                                <Dialog.Title className="text-2xl font-extrabold">
                                    {title}
                                </Dialog.Title>
                                {subtitle && (
                                    <span className="text-xl font-bold text-white/90">{subtitle}</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="min-h-touch shrink-0 rounded-xl border-2 border-white/70 px-6 text-lg font-extrabold text-surface"
                            >
                                閉じる
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

                        {footer && (
                            <div className="shrink-0 border-t-2 border-line px-5 py-4">{footer}</div>
                        )}
                    </Dialog.Panel>
                </Transition.Child>
            </div>
        </Dialog>
    </Transition>
)

export default Modal
