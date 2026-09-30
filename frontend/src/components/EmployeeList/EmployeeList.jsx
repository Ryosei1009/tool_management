import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../Util/PageTitle'
import SearchBar from '../Util/SearchBar'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import EmployeeModal from './EmployeeModal'
import { deleteEmployee, fetchEmployees, resolveImageUrl } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { Empty, ErrorMessage, Loading } from '../Util/AsyncState'
import { useAuth } from '../../auth/AuthContext'

// 社員1件分のカード。
// 権限は色ではなく文字と枠で区別し、貸出中の件数も件数そのものを表示する。
const EmployeeCard = ({ employee, isMe, canEdit, onEdit, onDelete }) => {
    const { name, id, team, permission, photoUrl, defaultPlace, rentingCount } = employee

    return (
        <li className="flex flex-wrap items-center gap-5 rounded-2xl border-2 border-ink bg-surface px-5 py-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-ink bg-field">
                <img
                    src={resolveImageUrl(photoUrl || '/img/tmp/tmp_icon.png')}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                />
            </div>

            <div className="min-w-52 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-extrabold">{name}</span>
                    {/* 自分の行は取り違え防止のため明示する */}
                    {isMe && (
                        <span className="rounded-full border-2 border-steel px-3 py-0.5 text-sm font-bold text-steel">
                            自分
                        </span>
                    )}
                    <span
                        className={`rounded-full border-2 px-3 py-0.5 text-sm font-bold ${
                            permission === '管理者'
                                ? 'border-accent text-accent'
                                : 'border-sub text-sub'
                        }`}
                    >
                        {permission}
                    </span>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-1 pt-1 text-lg font-bold">
                    <span>
                        <span className="mr-2 text-base font-medium text-sub">社員ID</span>
                        {id}
                    </span>
                    <span>
                        <span className="mr-2 text-base font-medium text-sub">所属班</span>
                        {team || '―'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-1 text-lg font-bold">
                    <span>
                        <span className="mr-2 text-base font-medium text-sub">既定の置き場所</span>
                        {defaultPlace ?? '未設定'}
                    </span>
                    <span>
                        <span className="mr-2 text-base font-medium text-sub">貸出中</span>
                        {rentingCount} 件
                    </span>
                </div>
            </div>

            {canEdit && (
                <div className="flex shrink-0 gap-3">
                    <Button size="md" variant="secondary" onClick={onEdit}>
                        編集
                    </Button>
                    <Button
                        size="md"
                        variant="danger"
                        onClick={onDelete}
                        disabled={isMe || rentingCount > 0}
                        // 押せない理由を色や淡さだけでなく文字でも伝える
                        title={
                            isMe
                                ? '自分自身は削除できません'
                                : rentingCount > 0
                                  ? '貸出中の工具があるため削除できません'
                                  : undefined
                        }
                    >
                        削除
                    </Button>
                </div>
            )}
        </li>
    )
}

const EmployeeList = () => {
    const { user } = useAuth()
    const isAdmin = user?.permission === '管理者'

    const [keyword, setKeyword] = useState('')
    const load = useCallback(() => fetchEmployees(), [])
    const { data: employees, loading, error, reload } = useFetch(load)

    const [editing, setEditing] = useState(null) // 編集対象（null=閉じている / 'new'=新規）
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false)
    const [busy, setBusy] = useState(false)
    const [actionError, setActionError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        if (!isDeleteConfirmed) return
        const target = deleteTarget
        setIsDeleteConfirmed(false)
        setDeleteTarget(null)
        if (!target || busy) return
        setBusy(true)
        setActionError('')
        setMessage('')
        deleteEmployee(target.id)
            .then(() => {
                setMessage(`${target.name} を削除しました。`)
                reload()
            })
            .catch((err) => setActionError(err.message))
            .finally(() => setBusy(false))
    }, [isDeleteConfirmed, deleteTarget, busy, reload])

    const filtered = keyword
        ? (employees ?? []).filter((e) =>
              [e.name, e.id, e.team, e.permission].some((v) => (v ?? '').includes(keyword))
          )
        : (employees ?? [])

    return (
        <>
            <div className="flex w-full items-start justify-center bg-surface pb-nav">
                <div className="w-full max-w-5xl px-6 pt-8">
                    <PageTitle
                        en="EMPLOYEES"
                        description={
                            isAdmin
                                ? '社員の追加・編集・削除ができます。貸出中の工具がある社員は削除できません。'
                                : '登録されている社員の一覧です。編集は管理者のみ行えます。'
                        }
                    >
                        社員一覧
                    </PageTitle>

                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <p className="text-xl font-extrabold">
                            {filtered.length} 名
                            {keyword && (
                                <span className="ml-2 text-base font-bold text-sub">
                                    （全 {(employees ?? []).length} 名中）
                                </span>
                            )}
                        </p>
                        {isAdmin && (
                            <Button icon="＋" onClick={() => setEditing('new')}>
                                社員を追加
                            </Button>
                        )}
                    </div>

                    <SearchBar
                        keyword={keyword}
                        onChange={setKeyword}
                        label="社員を検索"
                        placeholder="社員名 / 社員ID / 班 で検索"
                    />

                    {message && (
                        <p role="status" className="pb-4 text-lg font-bold text-state-good">
                            {message}
                        </p>
                    )}
                    {actionError && (
                        <p role="alert" className="pb-4 text-lg font-bold text-accent">
                            ✕ {actionError}
                        </p>
                    )}

                    {loading ? (
                        <Loading />
                    ) : error ? (
                        <ErrorMessage message={error} onRetry={reload} />
                    ) : filtered.length === 0 ? (
                        <Empty>該当する社員がいません</Empty>
                    ) : (
                        <ul className="flex flex-col gap-5">
                            {filtered.map((employee) => (
                                <EmployeeCard
                                    key={employee.id}
                                    employee={employee}
                                    isMe={employee.id === user?.id}
                                    canEdit={isAdmin}
                                    onEdit={() => setEditing(employee)}
                                    onDelete={() => {
                                        if (busy) return
                                        setDeleteTarget(employee)
                                    }}
                                />
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <EmployeeModal
                isOpen={editing !== null}
                setIsOpen={(open) => !open && setEditing(null)}
                employee={editing === 'new' ? null : editing}
                onSaved={() => {
                    setEditing(null)
                    setMessage('保存しました。')
                    reload()
                }}
            />

            <ConfirmModal
                isOpen={deleteTarget !== null}
                setIsOpen={(open) => !open && setDeleteTarget(null)}
                text={`${deleteTarget?.name ?? ''} を削除しますか？`}
                yesText="削除する"
                noText="やめる"
                setBoolean={setIsDeleteConfirmed}
                borderColor="border-accent"
                danger
            />
        </>
    )
}

export default EmployeeList
