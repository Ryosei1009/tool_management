import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment, useEffect, useState } from 'react'
import MapPicker from '../Util/MapPicker'
import Button from '../Util/Button'
import { createEmployee, updateEmployee } from '../../api'

// 入力欄。ラベルは常時表示（プレースホルダだけに頼らない）、必須は文字でも示す。
const Field = ({ id, label, required, hint, children }) => (
    <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-lg font-bold">
            {label}
            {required && <span className="ml-2 text-base text-accent">※必須</span>}
        </label>
        {children}
        {hint && <p className="text-base text-sub">{hint}</p>}
    </div>
)

const inputClass =
    'w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold outline-none'

const EMPTY = {
    id: '',
    name: '',
    team: '',
    bloodType: '',
    permission: '一般',
    password: '',
    defaultPin: null,
}

// 社員の追加 / 編集モーダル。employee が null なら新規追加。
const EmployeeModal = ({ isOpen, setIsOpen, employee, onSaved }) => {
    const isNew = !employee
    const [form, setForm] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isOpen) return
        setError('')
        setForm(
            employee
                ? {
                      id: employee.id,
                      name: employee.name ?? '',
                      team: employee.team ?? '',
                      bloodType: employee.bloodType ?? '',
                      permission: employee.permission ?? '一般',
                      password: '',
                      defaultPin: employee.defaultPin ?? null,
                  }
                : EMPTY
        )
    }, [isOpen, employee])

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

    const canSave = form.id && form.name && (!isNew || form.password) && !saving

    const handleSave = async () => {
        setSaving(true)
        setError('')
        try {
            if (isNew) {
                await createEmployee(form)
            } else {
                await updateEmployee({
                    id: form.id,
                    name: form.name,
                    team: form.team,
                    bloodType: form.bloodType,
                    permission: form.permission,
                    // 未設定に戻したいときは null を送る
                    defaultPin: form.defaultPin,
                })
            }
            onSaved?.()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
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
                    <div className="fixed inset-0 bg-black/60" />
                </Transition.Child>
                <div className="fixed inset-0 overflow-y-auto p-4">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="mx-auto my-4 w-full max-w-3xl rounded-2xl border-4 border-main bg-surface">
                            <div className="flex items-center justify-between gap-4 border-b-2 border-line bg-main px-5 py-4">
                                <Dialog.Title className="text-2xl font-extrabold">
                                    {isNew ? '社員を追加' : '社員情報を編集'}
                                </Dialog.Title>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    aria-label="閉じる"
                                    className="min-h-touch rounded-xl border-2 border-white/70 px-5 text-lg font-extrabold text-surface"
                                >
                                    閉じる
                                </button>
                            </div>

                            <div className="grid gap-6 px-5 py-6 md:grid-cols-2">
                                <div className="flex flex-col gap-5">
                                    <Field id="emp-id" label="社員ID" required hint="例：E-12345">
                                        <input
                                            id="emp-id"
                                            type="text"
                                            value={form.id}
                                            onChange={set('id')}
                                            disabled={!isNew}
                                            maxLength={32}
                                            className={`${inputClass} disabled:bg-field disabled:text-sub`}
                                        />
                                    </Field>

                                    <Field id="emp-name" label="社員名" required>
                                        <input
                                            id="emp-name"
                                            type="text"
                                            value={form.name}
                                            onChange={set('name')}
                                            maxLength={64}
                                            className={inputClass}
                                        />
                                    </Field>

                                    <Field id="emp-team" label="所属班">
                                        <input
                                            id="emp-team"
                                            type="text"
                                            value={form.team}
                                            onChange={set('team')}
                                            maxLength={64}
                                            className={inputClass}
                                        />
                                    </Field>

                                    <Field id="emp-blood" label="血液型">
                                        <input
                                            id="emp-blood"
                                            type="text"
                                            value={form.bloodType}
                                            onChange={set('bloodType')}
                                            maxLength={8}
                                            className={inputClass}
                                        />
                                    </Field>

                                    <Field id="emp-permission" label="権限">
                                        <select
                                            id="emp-permission"
                                            value={form.permission}
                                            onChange={set('permission')}
                                            className={inputClass}
                                        >
                                            <option value="一般">一般</option>
                                            <option value="管理者">管理者</option>
                                        </select>
                                    </Field>

                                    {isNew && (
                                        <Field
                                            id="emp-password"
                                            label="初期パスワード"
                                            required
                                            hint="本人に伝え、初回ログイン後に変更してもらってください。"
                                        >
                                            <input
                                                id="emp-password"
                                                type="text"
                                                value={form.password}
                                                onChange={set('password')}
                                                className={inputClass}
                                            />
                                        </Field>
                                    )}
                                </div>

                                <div>
                                    <p className="pb-2 text-lg font-bold">工具を借りるときの置き場所</p>
                                    <p className="pb-3 text-base text-sub">
                                        この社員が工具を借りるときの初期値になります。
                                    </p>
                                    <MapPicker
                                        pin={form.defaultPin}
                                        setPin={(pin) => setForm((f) => ({ ...f, defaultPin: pin }))}
                                        label="既定の置き場所"
                                    />
                                    {form.defaultPin && (
                                        <Button
                                            size="md"
                                            variant="secondary"
                                            className="mt-4"
                                            onClick={() => setForm((f) => ({ ...f, defaultPin: null }))}
                                        >
                                            置き場所を未設定に戻す
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="border-t-2 border-line px-5 py-5">
                                {error && (
                                    <p role="alert" className="pb-3 text-lg font-bold text-accent">
                                        ✕ {error}
                                    </p>
                                )}
                                <div className="flex gap-4">
                                    <Button
                                        variant="secondary"
                                        className="w-1/2"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        やめる
                                    </Button>
                                    <Button
                                        className="w-1/2"
                                        onClick={handleSave}
                                        disabled={!canSave}
                                    >
                                        {saving ? '保存中...' : '保存する'}
                                    </Button>
                                </div>
                            </div>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    )
}

export default EmployeeModal
