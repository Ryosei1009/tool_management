import React, { useEffect, useState } from 'react'
import Modal from '../Util/Modal'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import StateBadge from '../Util/StateBadge'
import MapPicker from '../Util/MapPicker'
import { TOOL_STATES } from '../../utils/toolState'
import { fetchTool, resolveImageUrl, updateTool } from '../../api'

const DetailModal = ({ isOpen, setIsOpen, toolId, onUpdated }) => {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [tool, setTool] = useState(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // モーダルを開いたときに最新の工具詳細（履歴込み）を取得する
    useEffect(() => {
        if (!isOpen || !toolId) return
        let ignore = false
        setLoading(true)
        setError('')
        fetchTool(toolId)
            .then((data) => {
                if (!ignore) setTool(data)
            })
            .catch((err) => {
                if (!ignore) setError(err.message)
            })
            .finally(() => {
                if (!ignore) setLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [isOpen, toolId])

    // 確認モーダルで「更新する」が押されたら保存する
    useEffect(() => {
        if (!isConfirmed) return
        setIsConfirmed(false)
        setIsConfirmOpen(false)
        if (!tool || saving) return
        setSaving(true)
        setError('')
        updateTool({
            id: tool.id,
            state: tool.state,
            lastInspectionDate: tool.lastInspectionDate || null,
            pin: tool.pin,
        })
            .then(() => onUpdated?.())
            .catch((err) => setError(err.message))
            .finally(() => setSaving(false))
    }, [isConfirmed, tool, saving, onUpdated])

    return (
        <>
            <Modal
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                title="工具の詳細"
                subtitle={tool?.name}
                footer={
                    tool && (
                        <>
                            {error && (
                                <p role="alert" className="pb-3 text-lg font-bold text-accent">
                                    ✕ {error}
                                </p>
                            )}
                            <Button
                                className="w-full"
                                onClick={() => setIsConfirmOpen(true)}
                                disabled={saving}
                            >
                                {saving ? '更新中...' : '変更を保存する'}
                            </Button>
                        </>
                    )
                }
            >
                {loading || !tool ? (
                    <p role="status" className="py-16 text-center text-xl font-bold text-sub">
                        {error || '読み込み中...'}
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
                                <label htmlFor="tool-state" className="text-lg font-bold">
                                    状態を変更する
                                </label>
                                <select
                                    id="tool-state"
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

                            <div className="flex flex-col gap-2">
                                <label htmlFor="tool-inspection" className="text-lg font-bold">
                                    最終点検日
                                </label>
                                <input
                                    id="tool-inspection"
                                    type="date"
                                    value={tool.lastInspectionDate ?? ''}
                                    onChange={(e) =>
                                        setTool({ ...tool, lastInspectionDate: e.target.value })
                                    }
                                    className="w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            <MapPicker
                                pin={tool.pin}
                                setPin={(pin) => setTool({ ...tool, pin })}
                                label="置き場所"
                            />

                            <div>
                                <h3 className="pb-2 text-lg font-bold">使用履歴</h3>
                                <div className="max-h-72 overflow-y-auto rounded-xl border-2 border-line bg-field p-4">
                                    {(tool.history ?? []).length === 0 ? (
                                        <p className="text-lg font-bold text-sub">履歴はありません</p>
                                    ) : (
                                        <ul className="flex flex-col gap-3">
                                            {tool.history.map((h, i) => (
                                                <li key={i} className="text-lg font-bold">
                                                    {h.start} 〜 {h.end}
                                                    <span className="ml-3 font-medium text-sub">
                                                        {h.user}
                                                    </span>
                                                    {h.status === 'renting' && (
                                                        <span className="ml-3 font-extrabold text-accent">
                                                            貸出中
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
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
        </>
    )
}

export default DetailModal
