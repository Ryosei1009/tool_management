import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment, useEffect, useRef } from 'react'

const ConfirmModal = ({ isOpen, setIsOpen, text, yesText, noText, setBoolean, borderColor }) => {
    const confirm = ({ boolean }) => {
        setBoolean(boolean)
    }

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
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0">
                        <Dialog.Panel className={`min-w-72 border-8 bg-base ${borderColor} py-6 px-12 rounded-2xl flex flex-col items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg`}>
                            <div className="text-2xl font-bold">
                                {text}
                            </div>
                            <div className="flex gap-6 mt-6">
                                <div onClick={() => confirm({ boolean: true })} className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-6 max-sm:px-3 rounded">
                                    {yesText}
                                </div>
                                <div onClick={() => setIsOpen(false)} className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-6 max-sm:px-3 rounded">
                                    {noText}
                                </div>
                            </div>
                        </Dialog.Panel>
                    </div>
                </Transition.Child>
            </Dialog>
        </Transition>
    )
}

export default ConfirmModal
