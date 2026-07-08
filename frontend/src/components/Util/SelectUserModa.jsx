import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment, useEffect, useRef, useState } from 'react'
import ConfirmModal from './ConfirmModal'

const SelectUserModal = ({ isOpen, setIsOpen }) => {
    const users = [
        { id: 1, name: '田中 太郎' },
        { id: 2, name: '田中 次郎' },
        { id: 3, name: '田中 三郎' },
        { id: 4, name: '田中 四郎' },
        { id: 5, name: '田中 五郎' },
        { id: 6, name: '田中 六郎' },
        { id: 7, name: '田中 七郎' },
        { id: 8, name: '田中 八郎' },
        { id: 9, name: '田中 九郎' },
        { id: 10, name: '田中 十郎' },
        { id: 11, name: '田中 十一郎' },
        { id: 12, name: '田中 十二郎' },
        { id: 13, name: '田中 十三郎' },
    ]
    const [selectedUser, setSelectedUser] = useState(null)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)
        useEffect(() => {
            if (isConfirmed) {
                console.log('渡す処理を実行')
                window.location.reload()
            }
        }, [isConfirmed])

    return (
        <>
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
                            <Dialog.Panel className={`h-2/3 min-w-72 border-8 bg-base border-main py-6 px-12 rounded-2xl flex flex-col items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg`}>
                                <div className="text-2xl font-bold">
                                    ユーザー選択
                                </div>
                                <div className="overflow-y-auto flex gap-4 flex-col mt-4">
                                    {users.map((user) => (
                                        <div onClick={() => setSelectedUser(user)} key={user.id} className="flex items-center gap-4 w-96 border-2 rounded-full p-1">
                                            <img src={`img/tmp/1.jpg`} alt={user.name} className="w-16 h-16 rounded-full" />
                                            <span className="text-lg font-semibold">
                                                {user.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {selectedUser && (
                                    <div className="flex w-full pt-4">
                                        <div className="text-center w-1/2">
                                            <p className="text-lg font-semibold">選択されたユーザー</p>
                                            <p className="text-xl">{selectedUser.name}</p>
                                        </div>
                                        <button onClick={() => setIsConfirmOpen(true)} className="py-2 rounded-lg font-extrabold bg-main text-base w-1/2">
                                            渡す
                                        </button>
                                    </div>
                                )}
                            </Dialog.Panel>
                        </div>
                    </Transition.Child>
                </Dialog>
            </Transition>
            <ConfirmModal isOpen={isConfirmOpen} setIsOpen={setIsConfirmOpen} text="本当に渡しますか？" yesText="はい" noText="いいえ" setBoolean={setIsConfirmed} borderColor="border-main" />
        </>
    )
}

export default SelectUserModal
