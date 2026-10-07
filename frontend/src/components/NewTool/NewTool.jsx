import React, { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import PageTitle from '../Util/PageTitle'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import MapPicker from '../Util/MapPicker'
import DefectFields from '../Util/DefectFields'
import ChoiceInput from '../Util/ChoiceInput'
import { TOOL_STATES } from '../../utils/toolState'
import { getCategories, getPurchaseAge } from '../../utils/toolInfo'
import { createTool, fetchInspectionItems, fetchTools, resolveImageUrl, uploadToolImage } from '../../api'
import { useFetch } from '../../hooks/useFetch'

const inputClass =
    'w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold outline-none'

// 入力欄。ラベルは常時表示し、必須は文字でも示す。
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

const EMPTY = {
    name: '',
    id: '',
    category: '',
    purchaseDate: '',
    state: 'good',
    defectRank: null,
    defectNote: '',
    pin: null,
    photoUrl: '',
    inspectionItemIds: [],
}

const NewTool = () => {
    const [tool, setTool] = useState(EMPTY)
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState('')
    const [isConfirmOpen, setIsConfirmOpen] = useState(false)
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const qrRef = useRef(null)

    // 大項目の候補（既存の工具から）と、点検項目の選択肢
    const loadTools = useCallback(() => fetchTools(), [])
    const { data: tools } = useFetch(loadTools)
    const categories = getCategories(tools)
    const loadItems = useCallback(() => fetchInspectionItems(), [])
    const { data: inspectionItems } = useFetch(loadItems)
    const age = getPurchaseAge(tool.purchaseDate)

    // QRコードを {ID}.png としてダウンロードする
    const handleDownload = () => {
        const canvas = qrRef.current
        if (!canvas || !tool.id) return
        const url = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.href = url
        link.download = `${tool.id}.png`
        link.click()
    }

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0] ?? null
        setFile(selected)
        setPreview(selected ? URL.createObjectURL(selected) : '')
    }

    // 確認モーダルで「追加する」が押されたら、写真をアップロードしてから登録する
    const handleCreate = useCallback(async () => {
        setSubmitting(true)
        setError('')
        setMessage('')
        try {
            let photoUrl = tool.photoUrl
            if (file) {
                const uploaded = await uploadToolImage(file)
                photoUrl = uploaded.photoUrl
            }
            await createTool({
                id: tool.id,
                name: tool.name,
                category: tool.category.trim(),
                purchaseDate: tool.purchaseDate || null,
                state: tool.state,
                defectRank: tool.state === 'good' ? null : tool.defectRank,
                defectNote: tool.state === 'good' ? '' : tool.defectNote,
                pin: tool.pin,
                photoUrl,
                inspectionItemIds: tool.inspectionItemIds,
            })
            setIsConfirmOpen(false)
            setMessage(`「${tool.name}」（${tool.id}）を追加しました。QRコードを印刷して貼り付けてください。`)
            setTool(EMPTY)
            setFile(null)
            setPreview('')
        } catch (err) {
            setIsConfirmOpen(false)
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }, [file, tool])

    useEffect(() => {
        if (!isConfirmed) return
        setIsConfirmed(false)
        handleCreate()
    }, [isConfirmed, handleCreate])

    const canSubmit = tool.id && tool.name && !submitting

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-8">
                <PageTitle
                    en="ADD TOOL"
                    description="工具を登録し、QRコードを印刷して工具に貼り付けてください。"
                >
                    工具を追加
                </PageTitle>

                <div className="grid gap-8 md:grid-cols-2">
                    <div className="flex flex-col gap-5">
                        <Field id="tool-name" label="工具の名前" required hint="例：ペンチA">
                            <input
                                id="tool-name"
                                type="text"
                                value={tool.name}
                                onChange={(e) => setTool({ ...tool, name: e.target.value })}
                                maxLength={30}
                                placeholder="ペンチA"
                                className={inputClass}
                            />
                        </Field>

                        <Field
                            id="tool-id"
                            label="工具ID"
                            required
                            hint="QRコードに埋め込まれます。他の工具と重複しない番号にしてください。"
                        >
                            <input
                                id="tool-id"
                                type="text"
                                value={tool.id}
                                onChange={(e) => setTool({ ...tool, id: e.target.value })}
                                maxLength={30}
                                placeholder="PENCH-0001"
                                className={inputClass}
                            />
                        </Field>

                        <Field
                            id="tool-category"
                            label="大項目"
                            hint="工具リストの絞り込みに使います。一覧に無いときは「新しく入力する」を選んでください。"
                        >
                            <ChoiceInput
                                id="tool-category"
                                value={tool.category}
                                options={categories}
                                maxLength={32}
                                placeholder="切断工具"
                                onChange={(category) => setTool({ ...tool, category })}
                                className={inputClass}
                            />
                        </Field>

                        <Field
                            id="tool-purchase"
                            label="購入日"
                            hint={age ? `購入から ${age.label}` : '経過年数を買い替えの参考にします。'}
                        >
                            <input
                                id="tool-purchase"
                                type="date"
                                value={tool.purchaseDate}
                                onChange={(e) => setTool({ ...tool, purchaseDate: e.target.value })}
                                className={inputClass}
                            />
                        </Field>

                        <Field id="tool-new-state" label="現在の状態">
                            <select
                                id="tool-new-state"
                                value={tool.state}
                                onChange={(e) => setTool({ ...tool, state: e.target.value })}
                                className={inputClass}
                            >
                                {TOOL_STATES.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        {tool.state !== 'good' && (
                            <DefectFields
                                idPrefix="new-tool"
                                rank={tool.defectRank}
                                note={tool.defectNote}
                                onChange={({ rank, note }) => setTool({ ...tool, defectRank: rank, defectNote: note })}
                            />
                        )}

                        <Field id="tool-photo" label="写真">
                            <img
                                className="h-56 w-full rounded-xl border-2 border-ink bg-field object-contain"
                                src={preview || resolveImageUrl(tool.photoUrl || '/img/map.png')}
                                alt={preview ? '選択した写真' : '写真は未選択です'}
                            />
                            <input
                                id="tool-photo"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="mt-2 block w-full text-base file:mr-4 file:min-h-touch file:rounded-xl file:border-2 file:border-ink file:bg-surface file:px-6 file:text-lg file:font-extrabold file:text-ink"
                            />
                        </Field>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div>
                            <p className="pb-2 text-lg font-bold">持ち出し場所</p>
                            <MapPicker
                                pin={tool.pin}
                                setPin={(pin) => setTool({ ...tool, pin })}
                                label="持ち出し場所"
                            />
                        </div>

                        <fieldset className="rounded-xl border-2 border-line p-5">
                            <legend className="px-1 text-lg font-bold">点検項目</legend>
                            {(inspectionItems ?? []).length === 0 ? (
                                <p className="text-base text-sub">
                                    点検項目がまだありません。マイページの「点検項目の管理」から追加できます。
                                </p>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {inspectionItems.map((item) => {
                                        const checked = tool.inspectionItemIds.includes(item.id)
                                        return (
                                            <label key={item.id} className="flex min-h-touch items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() =>
                                                        setTool({
                                                            ...tool,
                                                            inspectionItemIds: checked
                                                                ? tool.inspectionItemIds.filter((id) => id !== item.id)
                                                                : [...tool.inspectionItemIds, item.id],
                                                        })
                                                    }
                                                />
                                                <span className="text-lg font-bold">{item.name}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </fieldset>

                        <div className="rounded-xl border-2 border-line bg-field p-5">
                            <p className="pb-3 text-lg font-bold">QRコード</p>
                            {tool.id ? (
                                <div className="flex flex-col items-center gap-4">
                                    <QRCodeCanvas
                                        ref={qrRef}
                                        value={tool.id}
                                        size={220}
                                        bgColor="#FFFFFF"
                                        fgColor="#000000"
                                        level="M"
                                        marginSize={4}
                                        className="rounded border-2 border-ink bg-surface"
                                    />
                                    <Button variant="secondary" onClick={handleDownload}>
                                        QRコードを保存する
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-lg font-bold text-sub">
                                    工具IDを入力するとQRコードが表示されます。
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-8">
                    {error && (
                        <p role="alert" className="pb-3 text-lg font-bold text-accent">
                            ✕ {error}
                        </p>
                    )}
                    {message && (
                        <p role="status" className="pb-3 text-lg font-bold text-state-good">
                            {message}
                        </p>
                    )}
                    <Button
                        className="w-full"
                        onClick={() => setIsConfirmOpen(true)}
                        disabled={!canSubmit}
                    >
                        {submitting ? '追加中...' : 'この内容で追加する'}
                    </Button>
                </div>
            </div>

            <ConfirmModal
                isOpen={isConfirmOpen}
                setIsOpen={setIsConfirmOpen}
                text={`${tool.name || 'この工具'} を追加しますか？`}
                yesText="追加する"
                noText="やめる"
                setBoolean={setIsConfirmed}
            />
        </div>
    )
}

export default NewTool
