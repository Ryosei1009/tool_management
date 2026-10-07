import React, { useEffect, useState } from 'react'
import Modal from '../Util/Modal'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import StateBadge from '../Util/StateBadge'
import DefectRankBadge from '../Util/DefectRankBadge'
import DefectFields from '../Util/DefectFields'
import MapPicker from '../Util/MapPicker'
import SlotInput from '../Util/SlotInput'
import ConflictAlert from '../Util/ConflictAlert'
import InfoRow from '../Util/InfoRow'
import SelectUserModal from '../Util/SelectUserModa'
import { TOOL_STATES } from '../../utils/toolState'
import { currentSlot, findConflicts, slotKey, toolOccupancy } from '../../utils/period'
import { fetchTool, renewRental, resolveImageUrl } from '../../api'

// 貸出中なら返却予定・状態・持ち出し場所の更新、予約なら期間の変更。
// 他の予約と重なる期間は、入力した時点で警告して保存できないようにする。
const RenewModal = ({ isOpen, setIsOpen, rental, onChanged }) => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isPassModalOpen, setIsPassModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [occupancy, setOccupancy] = useState([])

    // 一覧から渡された貸出情報を編集用の state に写す
    const [form, setForm] = useState(null)
    useEffect(() => {
        if (!isOpen || !rental) return
        setForm({
            state: rental.state ?? 'good',
            defectRank: rental.defectRank ?? null,
            defectNote: rental.defectNote ?? '',
            pin: rental.pin ?? { x: 50, y: 50 },
            start: rental.rentStart,
            startPeriod: rental.rentStartPeriod ?? 'am',
            end: rental.rentEnd,
            endPeriod: rental.rentEndPeriod ?? 'pm',
        })
        setError('')
        // 重なりを調べるため、この工具の予約・貸出の最新を取る
        let ignore = false
        fetchTool(rental.id)
            .then((tool) => !ignore && setOccupancy(toolOccupancy(tool)))
            .catch(() => !ignore && setOccupancy([]))
        return () => {
            ignore = true
        }
    }, [isOpen, rental])

    const isReserved = rental?.rentalStatus === 'reserved'
    const now = currentSlot()
    const range = form && {
        start: slotKey(form.start, form.startPeriod),
        end: slotKey(form.end, form.endPeriod),
    }
    const invalidRange = range && range.start > range.end
    const pastReserve = isReserved && range && range.start < slotKey(now.date, now.period)
    const conflicts = range ? findConflicts(range, occupancy, rental?.rentalId) : []

    const save = () => {
        setIsConfirmOpen(false)
        if (!form || saving) return
        setSaving(true)
        setError('')
        renewRental({
            rentalId: rental.rentalId,
            endDate: form.end,
            endPeriod: form.endPeriod,
            ...(isReserved
                ? { startDate: form.start, startPeriod: form.startPeriod }
                : {
                      state: form.state,
                      defectRank: form.state === 'good' ? null : form.defectRank,
                      defectNote: form.state === 'good' ? '' : form.defectNote,
                      pin: form.pin,
                  }),
        })
            .then(() => {
                setIsOpen(false)
                onChanged?.()
            })
            .catch((err) => setError(err.message))
            .finally(() => setSaving(false))
    }

    const disabled = saving || !form || invalidRange || pastReserve || conflicts.length > 0
    const label = saving
        ? '更新中...'
        : conflicts.length > 0
          ? '期間が重なっています'
          : invalidRange
            ? '返却予定を開始より後にしてください'
            : pastReserve
              ? '過去の日時は予約できません'
              : 'この内容で更新する'

    return (
        <>
            <Modal
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                title={isReserved ? '予約の変更' : '借りている工具'}
                subtitle={rental?.name}
                footer={
                    form && (
                        <>
                            {error && (
                                <p role="alert" className="whitespace-pre-line pb-3 text-lg font-bold text-accent">
                                    ✕ {error}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-4">
                                {!isReserved && (
                                    <Button
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={() => setIsPassModalOpen(true)}
                                        disabled={saving}
                                    >
                                        別の人に渡す
                                    </Button>
                                )}
                                <Button className="flex-1" onClick={() => setIsConfirmOpen(true)} disabled={disabled}>
                                    {label}
                                </Button>
                            </div>
                        </>
                    )
                }
            >
                {!form ? (
                    <p role="status" className="py-16 text-center text-xl font-bold text-sub">
                        読み込み中...
                    </p>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="flex flex-col gap-5">
                            <img
                                className="h-52 w-full rounded-xl border-2 border-ink object-contain"
                                src={resolveImageUrl(rental.photoUrl)}
                                alt={`${rental.name}の写真`}
                            />
                            <InfoRow label="名前">{rental.name}</InfoRow>
                            <InfoRow label="借りる人">{rental.user}</InfoRow>
                            {!isReserved && <InfoRow label="持出">{rental.takenAt || rental.startDate}</InfoRow>}
                            <InfoRow label="現在の状態">
                                <span className="flex flex-wrap gap-2">
                                    <StateBadge state={rental.state} size="lg" />
                                    <DefectRankBadge rank={rental.defectRank} size="lg" />
                                </span>
                            </InfoRow>

                            {!isReserved && (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="renew-state" className="text-lg font-bold">
                                            状態を変更する
                                        </label>
                                        <select
                                            id="renew-state"
                                            value={form.state}
                                            onChange={(e) => setForm({ ...form, state: e.target.value })}
                                            className="w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold"
                                        >
                                            {TOOL_STATES.map((s) => (
                                                <option key={s.value} value={s.value}>
                                                    {s.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {form.state !== 'good' && (
                                        <DefectFields
                                            idPrefix="renew"
                                            rank={form.defectRank}
                                            note={form.defectNote}
                                            onChange={({ rank, note }) =>
                                                setForm({ ...form, defectRank: rank, defectNote: note })
                                            }
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex flex-col gap-6">
                            <fieldset className="flex flex-col gap-4">
                                <legend className="pb-1 text-lg font-bold">
                                    {isReserved ? '予約する期間' : '返却予定'}
                                </legend>
                                {isReserved && (
                                    <SlotInput
                                        id="renew-start"
                                        label="開始"
                                        date={form.start}
                                        period={form.startPeriod}
                                        min={now.date}
                                        onChange={({ date, period }) =>
                                            setForm({ ...form, start: date, startPeriod: period })
                                        }
                                    />
                                )}
                                <SlotInput
                                    id="renew-end"
                                    label=""
                                    date={form.end}
                                    period={form.endPeriod}
                                    min={isReserved ? form.start : now.date}
                                    onChange={({ date, period }) => setForm({ ...form, end: date, endPeriod: period })}
                                />
                            </fieldset>

                            <ConflictAlert conflicts={conflicts} />

                            {!isReserved && (
                                <MapPicker
                                    pin={form.pin}
                                    setPin={(pin) => setForm({ ...form, pin })}
                                    label="持ち出し場所"
                                />
                            )}
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
                setBoolean={(yes) => yes && save()}
            />

            <SelectUserModal
                isOpen={isPassModalOpen}
                setIsOpen={setIsPassModalOpen}
                toolName={rental?.name}
                rentalId={rental?.rentalId}
                currentUserId={rental?.userId}
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
