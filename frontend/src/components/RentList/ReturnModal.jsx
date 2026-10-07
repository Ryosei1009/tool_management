import { useState } from 'react'
import Modal from '../Util/Modal'
import Button from '../Util/Button'
import StateBadge from '../Util/StateBadge'
import DefectRankBadge from '../Util/DefectRankBadge'
import DefectFields from '../Util/DefectFields'
import Segmented from '../Util/Segmented'
import InfoRow from '../Util/InfoRow'
import { TOOL_STATES } from '../../utils/toolState'
import { resolveImageUrl, returnRental } from '../../api'
import { useAuth } from '../../auth/AuthContext'

// 返却。返すときの工具の状態（不具合があればその内容）も一緒に記録する。
// 問題がなければ「返却する」を押すだけで済むよう、状態の初期値は今の状態にしておく。
// 入力内容は貸出ごとに持つので、呼び出し側で key={rentalId} を付けて作り直すこと。
const ReturnModal = ({ isOpen, setIsOpen, rental, onReturned }) => {
    const { user } = useAuth()
    const [form, setForm] = useState(() =>
        rental ? { state: rental.state, defectRank: rental.defectRank, defectNote: rental.defectNote ?? '' } : null
    )
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const submit = () => {
        if (saving || !form) return
        setSaving(true)
        setError('')
        returnRental({
            rentalId: rental.rentalId,
            state: form.state,
            defectRank: form.state === 'good' ? null : form.defectRank,
            defectNote: form.state === 'good' ? '' : form.defectNote,
        })
            .then(() => {
                setIsOpen(false)
                onReturned?.(rental)
            })
            .catch((err) => setError(err.message))
            .finally(() => setSaving(false))
    }

    const proxy = rental && rental.userId !== user?.id

    return (
        <Modal
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            title="工具を返す"
            subtitle={rental?.name}
            maxWidth="max-w-3xl"
            footer={
                <>
                    {error && (
                        <p role="alert" className="whitespace-pre-line pb-3 text-lg font-bold text-accent">
                            ✕ {error}
                        </p>
                    )}
                    <Button variant="danger" className="w-full" onClick={submit} disabled={saving || !form}>
                        {saving ? '返却中...' : proxy ? `${rental.user} さんの代わりに返却する` : '返却する'}
                    </Button>
                </>
            }
        >
            {rental && form && (
                <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-5">
                        <img
                            className="h-24 w-24 shrink-0 rounded-xl border-2 border-ink object-cover"
                            src={resolveImageUrl(rental.photoUrl)}
                            alt=""
                            aria-hidden="true"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <InfoRow label="借りた人">{rental.user}</InfoRow>
                            <InfoRow label="持出">{rental.takenAt || rental.startDate}</InfoRow>
                        </div>
                    </div>

                    <InfoRow label="今の状態">
                        <span className="flex flex-wrap gap-2">
                            <StateBadge state={rental.state} size="lg" />
                            <DefectRankBadge rank={rental.defectRank} size="lg" />
                        </span>
                    </InfoRow>

                    <div className="flex flex-col gap-2">
                        <p className="text-lg font-bold">返すときの状態</p>
                        <Segmented
                            label="返すときの状態"
                            options={TOOL_STATES}
                            value={form.state}
                            onChange={(state) => setForm({ ...form, state })}
                            size="lg"
                        />
                    </div>

                    {form.state !== 'good' && (
                        <DefectFields
                            idPrefix="return"
                            rank={form.defectRank}
                            note={form.defectNote}
                            onChange={({ rank, note }) => setForm({ ...form, defectRank: rank, defectNote: note })}
                        />
                    )}

                    <p className="text-base text-sub">返却の日時は、押した時刻で記録されます。</p>
                </div>
            )}
        </Modal>
    )
}

export default ReturnModal
