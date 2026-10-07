import React, { useCallback, useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import ConfirmModal from './ConfirmModal'
import { fetchEmployees, resolveImageUrl, transferRental } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { useFetch } from '../../hooks/useFetch'
import { Empty, ErrorMessage, Loading } from './AsyncState'

// 工具を別の社員へ渡すときの相手選択。
// 誰を選んでいるかは、色の変化だけでなく枠線の太さと「選択中」の文字で示す。
const SelectUserModal = ({ isOpen, setIsOpen, rentalId, toolName, currentUserId, onTransferred }) => {
    const { user } = useAuth()
    // 閉じている間は取得しない
    const load = useCallback(() => fetchEmployees(), [])
    const { data: employees, loading, error, reload } = useFetch(load, { enabled: isOpen })

    const [selectedUser, setSelectedUser] = useState(null)
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [saving, setSaving] = useState(false)
    const [actionError, setActionError] = useState('')

    useEffect(() => {
        if (!isOpen) setSelectedUser(null)
    }, [isOpen])

    useEffect(() => {
        if (!isConfirmed) return
        const target = selectedUser
        setIsConfirmed(false)
        setIsConfirmOpen(false)
        if (!target || saving) return
        setSaving(true)
        setActionError('')
        transferRental({ rentalId, toEmployeeId: target.id })
            .then(() => {
                setSelectedUser(null)
                onTransferred?.()
            })
            .catch((err) => setActionError(err.message))
            .finally(() => setSaving(false))
    }, [isConfirmed, selectedUser, saving, rentalId, onTransferred])

    // 今借りている人には渡せないので一覧から除く（代理で操作しているときは借りている本人）
    const holderId = currentUserId ?? user?.id
    const candidates = (employees ?? []).filter((e) => e.id !== holderId)

    return (
        <>
            <Modal
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                title="渡す相手を選ぶ"
                subtitle={toolName}
                maxWidth="max-w-3xl"
                footer={
                    <>
                        {actionError && (
                            <p role="alert" className="pb-3 text-lg font-bold text-accent">
                                ✕ {actionError}
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-4">
                            <p className="flex-1 text-xl font-bold">
                                <span className="mr-3 text-base text-sub">選択中</span>
                                {selectedUser?.name ?? '未選択'}
                            </p>
                            <Button
                                onClick={() => setIsConfirmOpen(true)}
                                disabled={!selectedUser || saving}
                            >
                                {saving ? '処理中...' : 'この人に渡す'}
                            </Button>
                        </div>
                    </>
                }
            >
                {loading ? (
                    <Loading />
                ) : error ? (
                    <ErrorMessage message={error} onRetry={reload} />
                ) : candidates.length === 0 ? (
                    <Empty>渡せる社員がいません</Empty>
                ) : (
                    <ul className="flex flex-col gap-4">
                        {candidates.map((employee) => {
                            const isSelected = selectedUser?.id === employee.id
                            return (
                                <li key={employee.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedUser(employee)}
                                        aria-pressed={isSelected}
                                        className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left ${
                                            isSelected
                                                ? 'border-4 border-main bg-field'
                                                : 'border-2 border-ink bg-surface'
                                        }`}
                                    >
                                        <img
                                            src={
                                                resolveImageUrl(employee.photoUrl || '/img/tmp/tmp_icon.png')
                                            }
                                            alt=""
                                            aria-hidden="true"
                                            className="h-16 w-16 shrink-0 rounded-full border-2 border-ink object-cover"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-2xl font-extrabold">
                                                {employee.name}
                                            </span>
                                            <span className="block text-base text-sub">
                                                {employee.team || '―'}
                                            </span>
                                        </span>
                                        {isSelected && (
                                            <span className="shrink-0 rounded-full bg-main px-4 py-1 text-base text-surface font-extrabold">
                                                選択中
                                            </span>
                                        )}
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </Modal>

            <ConfirmModal
                isOpen={isConfirmOpen}
                setIsOpen={setIsConfirmOpen}
                text={`${selectedUser?.name ?? ''} に渡しますか？`}
                yesText="渡す"
                noText="やめる"
                setBoolean={setIsConfirmed}
            />
        </>
    )
}

export default SelectUserModal
