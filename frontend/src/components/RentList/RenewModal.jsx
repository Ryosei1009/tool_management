import React, { useEffect, useState } from 'react'
import Modal from '../Util/Modal'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import StateBadge from '../Util/StateBadge'
import MapPicker from '../Util/MapPicker'
import SelectUserModal from '../Util/SelectUserModa'
import { TOOL_STATES } from '../../utils/toolState'
import { renewRental, resolveImageUrl } from '../../api'

const RenewModal = ({ isOpen, setIsOpen, rental, onChanged }) => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [isPassModalOpen, setIsPassModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // 一覧から渡された貸出情報を編集用の state に写す
    const [tool, setTool] = useState(null)
    useEffect(() => {
        if (!rental) return
        setTool({
            rentalId: rental.rentalId,
            id: rental.id,
            name: rental.name,
            photoUrl: rental.photoUrl,
            state: rental.state ?? 'good',
            pin: rental.pin ?? { x: 50, y: 50 },
            lastRent: { start: rental.rentStart, end: rental.rentEnd },
        })
        setError('')
    }, [rental])

    // 確認モーダルで「更新する」が押されたら保存する
    useEffect(() => {
        if (!isConfirmed) return
        setIsConfirmed(false)
        setIsConfirmOpen(false)
        if (!tool || saving) return
        setSaving(true)
        setError('')
        renewRental({
            rentalId: tool.rentalId,
            startDate: tool.lastRent.start,
            endDate: tool.lastRent.end,
            state: tool.state,
            pin: tool.pin,
        })
            .then(() => {
                setIsOpen(false)
                onChanged?.()
            })
            .catch((err) => setError(err.message))
            .finally(() => setSaving(false))
    }, [isConfirmed, tool, saving, setIsOpen, onChanged])

    return (
        <>
            <Modal
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                title="借りている工具"
                subtitle={tool?.name}
                footer={
                    tool && (
                        <>
                            {error && (
                                <p role="alert" className="pb-3 text-lg font-bold text-accent">
                                    ✕ {error}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-4">
                                <Button
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => setIsPassModalOpen(true)}
                                    disabled={saving}
                                >
                                    別の人に渡す
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={() => setIsConfirmOpen(true)}
                                    disabled={saving}
                                >
                                    {saving ? '更新中...' : 'この内容で更新する'}
                                </Button>
                            </div>
                        </>
                    )
                }
            >
                {!tool ? (
                    <p role="status" className="py-16 text-center text-xl font-bold text-sub">
                        読み込み中...
                    </p>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2">
                        <div className="flex flex-col gap-5">
                            <img
                                className="h-64 w-full rounded-xl border-2 border-ink object-contain"
                                src={resolveImageUrl(tool.photoUrl)}
                                alt={`${tool.name}の写真`}
                            />

                            <div className="flex items-baseline gap-4 border-b-2 border-dashed border-line pb-3">
                                <span className="w-24 shrink-0 text-base text-sub">名前</span>
                                <span className="text-2xl font-extrabold">{tool.name}</span>
                            </div>

                            <div className="flex items-baseline gap-4 border-b-2 border-dashed border-line pb-3">
                                <span className="w-24 shrink-0 text-base text-sub">ID</span>
                                <span className="text-2xl font-extrabold">{tool.id}</span>
                            </div>

                            <div className="flex items-baseline gap-4 border-b-2 border-dashed border-line pb-3">
                                <span className="w-24 shrink-0 text-base text-sub">現在の状態</span>
                                <StateBadge state={tool.state} size="lg" />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label htmlFor="renew-state" className="text-lg font-bold">
                                    状態を変更する
                                </label>
                                <select
                                    id="renew-state"
                                    value={tool.state}
                                    onChange={(e) => setTool({ ...tool, state: e.target.value })}
                                    className="w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold"
                                >
                                    {TOOL_STATES.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            <fieldset className="flex flex-col gap-3">
                                <legend className="pb-1 text-lg font-bold">借りる期間</legend>
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="renew-start" className="text-base text-sub">
                                        貸出日
                                    </label>
                                    <input
                                        id="renew-start"
                                        type="date"
                                        value={tool.lastRent.start}
                                        onChange={(e) =>
                                            setTool({
                                                ...tool,
                                                lastRent: { ...tool.lastRent, start: e.target.value },
                                            })
                                        }
                                        className="w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="renew-end" className="text-base text-sub">
                                        返却予定日
                                    </label>
                                    <input
                                        id="renew-end"
                                        type="date"
                                        value={tool.lastRent.end}
                                        onChange={(e) =>
                                            setTool({
                                                ...tool,
                                                lastRent: { ...tool.lastRent, end: e.target.value },
                                            })
                                        }
                                        className="w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold"
                                    />
                                </div>
                            </fieldset>

                            <MapPicker
                                pin={tool.pin}
                                setPin={(pin) => setTool({ ...tool, pin })}
                                label="置き場所"
                            />
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal
                isOpen={isConfirmOpen}
                setIsOpen={setIsConfirmOpen}
                text="この内容で更新しますか？"
                yesText="更新する"
                noText="やめる"
                setBoolean={setIsConfirmed}
            />

            <SelectUserModal
                isOpen={isPassModalOpen}
                setIsOpen={setIsPassModalOpen}
                toolName={tool?.name}
                rentalId={tool?.rentalId}
                onTransferred={() => {
                    setIsPassModalOpen(false)
                    setIsOpen(false)
                    onChanged?.()
                }}
            />
        </>
    )
}

export default RenewModal
