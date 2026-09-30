import React, { useEffect, useState } from 'react'
import Modal from '../Util/Modal'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import StateBadge from '../Util/StateBadge'
import MapPicker from '../Util/MapPicker'
import { notFoundTool, toRentTool } from '../../utils/tools'
import { createRental, fetchTool, resolveImageUrl } from '../../api'
import { useAuth } from '../../auth/AuthContext'

const RentModal = ({ isOpen, setIsOpen, toolId, onRented }) => {
    const { user } = useAuth()
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [tool, setTool] = useState(() => notFoundTool(toolId))
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // QR/検索で得た ID から工具をサーバーに問い合わせる。
    // 置き場所の初期値は、借りる人がマイページで登録した既定の場所（未設定なら工具の現在地）。
    useEffect(() => {
        if (!isOpen || !toolId) return
        let ignore = false
        setLoading(true)
        setError('')
        fetchTool(toolId)
            .then((data) => {
                if (!ignore) setTool(toRentTool(data, user?.defaultPin))
            })
            .catch((err) => {
                if (ignore) return
                // 404 は「該当なし」表示、それ以外は通信エラーとして出す
                setTool(notFoundTool(toolId))
                if (err.status !== 404) setError(err.message)
            })
            .finally(() => {
                if (!ignore) setLoading(false)
            })
        return () => {
            ignore = true
        }
    }, [isOpen, toolId, user?.defaultPin])

    // 確認モーダルで「借りる」が押されたら貸出を登録する
    useEffect(() => {
        if (!isConfirmed) return
        setIsConfirmed(false)
        setIsConfirmOpen(false)
        if (saving) return
        setSaving(true)
        setError('')
        createRental({
            toolId: tool.id,
            startDate: tool.lastRent.start,
            endDate: tool.lastRent.end,
            reserved: tool.reserved,
            pin: tool.pin,
        })
            .then(() => {
                setIsOpen(false)
                onRented?.()
            })
            .catch((err) => setError(err.message))
            .finally(() => setSaving(false))
    }, [isConfirmed, tool, saving, setIsOpen, onRented])

    const disabled = tool.notFound || loading || tool.isRented || saving

    const buttonLabel = tool.notFound
        ? '該当する工具がありません'
        : tool.isRented
          ? `貸出中です（${tool.user}）`
          : saving
            ? '登録中...'
            : 'この内容で借りる'

    return (
        <>
            <Modal
                isOpen={isOpen}
                setIsOpen={setIsOpen}
                title="工具を借りる"
                subtitle={loading ? '読み込み中...' : tool.notFound ? '該当なし' : tool.name}
                footer={
                    <>
                        {error && (
                            <p role="alert" className="pb-3 text-lg font-bold text-accent">
                                ✕ {error}
                            </p>
                        )}
                        <Button
                            className="w-full"
                            onClick={() => setIsConfirmOpen(true)}
                            disabled={disabled}
                        >
                            {buttonLabel}
                        </Button>
                    </>
                }
            >
                <div className="grid gap-8 md:grid-cols-2">
                    <div className="flex flex-col gap-5">
                        <img
                            className="h-64 w-full rounded-xl border-2 border-ink object-contain"
                            src={resolveImageUrl(tool.photoUrl)}
                            alt={tool.name ? `${tool.name}の写真` : ''}
                        />

                        <div className="flex items-baseline gap-4 border-b-2 border-dashed border-line pb-3">
                            <span className="w-24 shrink-0 text-base text-sub">名前</span>
                            <span className="text-2xl font-extrabold">{tool.name || '―'}</span>
                        </div>

                        <div className="flex items-baseline gap-4 border-b-2 border-dashed border-line pb-3">
                            <span className="w-24 shrink-0 text-base text-sub">ID</span>
                            <span className="text-2xl font-extrabold">{tool.id || '―'}</span>
                        </div>

                        <div className="flex items-baseline gap-4 border-b-2 border-dashed border-line pb-3">
                            <span className="w-24 shrink-0 text-base text-sub">状態</span>
                            <StateBadge state={tool.state} size="lg" />
                        </div>

                        <fieldset className="flex flex-col gap-3">
                            <legend className="pb-1 text-lg font-bold">借りる期間</legend>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="rent-start" className="text-base text-sub">
                                    貸出日
                                </label>
                                <input
                                    id="rent-start"
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
                                <label htmlFor="rent-end" className="text-base text-sub">
                                    返却予定日
                                </label>
                                <input
                                    id="rent-end"
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
                    </div>

                    <div className="flex flex-col gap-6">
                        <div>
                            <p className="pb-2 text-lg font-bold">工具を置く場所</p>
                            {/* 既定の置き場所が入っているときは、その旨を明示して確認を促す */}
                            {user?.defaultPin && (
                                <p className="pb-3 text-base text-sub">
                                    マイページで登録した既定の場所を初期値にしています。違う場合は変更してください。
                                </p>
                            )}
                            <MapPicker
                                pin={tool.pin}
                                setPin={(pin) => setTool({ ...tool, pin })}
                                label="置き場所"
                            />
                        </div>

                        <label className="flex items-center gap-4 rounded-xl border-2 border-line bg-field px-5 py-4">
                            <input
                                type="checkbox"
                                checked={tool.reserved}
                                onChange={(e) => setTool({ ...tool, reserved: e.target.checked })}
                            />
                            <span className="text-xl font-bold">貸し出しを予約する</span>
                        </label>
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={isConfirmOpen}
                setIsOpen={setIsConfirmOpen}
                text={`${tool.name} を借りますか？`}
                yesText="借りる"
                noText="やめる"
                setBoolean={setIsConfirmed}
            />
        </>
    )
}

export default RentModal
