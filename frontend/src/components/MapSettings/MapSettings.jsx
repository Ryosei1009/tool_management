import { useState } from 'react'
import PageTitle from '../Util/PageTitle'
import Button from '../Util/Button'
import ConfirmModal from '../Util/ConfirmModal'
import { Empty } from '../Util/AsyncState'
import { resolveImageUrl, saveMapConfig, uploadToolImage } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { isAdmin } from '../../utils/roles'
import {
    DEFAULT_MAP_IMAGE,
    MAX_GRID,
    buildGrid,
    defaultRegionName,
    getMapConfig,
    setMapConfig,
} from '../../utils/map'

const inputClass = 'w-full rounded-xl border-2 border-ink bg-surface px-4 text-xl font-bold'

const SIZES = Array.from({ length: MAX_GRID }, (_, i) => i + 1)

// マップ（持ち出し場所）の設定（管理者のみ）。
// マップ画像を差し替え、区画を「縦 × 横」の数と名前で決める。
// 工具や社員のピンの位置はそのままなので、同じ位置のピンが新しい区画名で表示される。
const MapSettings = () => {
    const { user, reload: reloadAuth } = useAuth()
    const admin = isAdmin(user)

    const [saved, setSaved] = useState(getMapConfig)
    // 縦・横の数。初期の区画（不揃いの A1〜A9）のままのときは 3 × 3 を初期値にする
    const [rows, setRows] = useState(saved.rows ?? 3)
    const [cols, setCols] = useState(saved.cols ?? 3)
    const [names, setNames] = useState(() => (saved.rows ? saved.regions.map((r) => r.name) : []))
    const [imageUrl, setImageUrl] = useState(saved.imageUrl ?? null)
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [confirm, setConfirm] = useState(null)

    // 画像を選ぶ・取り消す。プレビュー用の URL も一緒に持つ。
    const chooseFile = (selected) => {
        setFile(selected)
        setPreview(selected ? URL.createObjectURL(selected) : '')
    }

    if (!admin) {
        return (
            <div className="px-6 pt-8 pb-nav">
                <Empty>この画面は管理者のみ利用できます</Empty>
            </div>
        )
    }

    const count = rows * cols
    const regions = buildGrid(rows, cols, names)
    const regionNames = regions.map((r) => r.name)
    const duplicated = regionNames.filter((n, i) => regionNames.indexOf(n) !== i)
    const usingDefault = !saved.rows

    const apply = (next) => {
        setMapConfig(next)
        setSaved(next)
        setRows(next.rows ?? 3)
        setCols(next.cols ?? 3)
        setNames(next.rows ? next.regions.map((r) => r.name) : [])
        setImageUrl(next.imageUrl ?? null)
        chooseFile(null)
        // 他の画面（ヘッダーなど）にも新しい設定を使ってもらう
        reloadAuth()
    }

    const run = async (action, successMessage) => {
        setConfirm(null)
        setSaving(true)
        setError('')
        setMessage('')
        try {
            apply(await action())
            setMessage(successMessage)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const save = () =>
        run(async () => {
            let nextImage = imageUrl
            if (file) nextImage = (await uploadToolImage(file)).photoUrl
            return saveMapConfig({ imageUrl: nextImage, rows, cols, names: names.slice(0, count) })
        }, 'マップの設定を保存しました。')

    const reset = () => run(() => saveMapConfig({ reset: true }), '初期のマップと区画に戻しました。')

    const src = preview || resolveImageUrl(imageUrl || DEFAULT_MAP_IMAGE)

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-6">
                <PageTitle
                    en="MAP"
                    description="マップの画像と、持ち出し場所の区画（数と名前）を変更できます。工具のピンの位置は変わりません。"
                >
                    マップの設定
                </PageTitle>

                {usingDefault && (
                    <p className="mb-6 rounded-xl border-2 border-line bg-field p-4 text-lg font-bold">
                        今は初期の区画（A1〜A9）を使っています。下で数と名前を決めて保存すると、均等な区画に切り替わります。
                    </p>
                )}

                <div className="grid gap-8 md:grid-cols-2">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="map-image" className="text-lg font-bold">
                                マップの画像
                            </label>
                            <input
                                id="map-image"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                                className="block w-full text-base file:mr-4 file:min-h-touch file:rounded-xl file:border-2 file:border-ink file:bg-surface file:px-6 file:text-lg file:font-extrabold file:text-ink"
                            />
                            <p className="text-base text-sub">
                                JPEG・PNG・WebP・GIF（5MB まで）。選ばなければ今の画像のままです。
                            </p>
                            {(imageUrl || file) && (
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={() => {
                                        chooseFile(null)
                                        setImageUrl(null)
                                    }}
                                >
                                    初期の画像に戻す
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label htmlFor="map-rows" className="text-lg font-bold">
                                    縦の数
                                </label>
                                <select
                                    id="map-rows"
                                    value={rows}
                                    onChange={(e) => setRows(Number(e.target.value))}
                                    className={inputClass}
                                >
                                    {SIZES.map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="map-cols" className="text-lg font-bold">
                                    横の数
                                </label>
                                <select
                                    id="map-cols"
                                    value={cols}
                                    onChange={(e) => setCols(Number(e.target.value))}
                                    className={inputClass}
                                >
                                    {SIZES.map((n) => (
                                        <option key={n} value={n}>
                                            {n}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <fieldset className="rounded-xl border-2 border-line p-4">
                            <legend className="px-1 text-lg font-bold">区画の名前（{count} か所）</legend>
                            <p className="pb-3 text-base text-sub">
                                左上から右へ、上から下への順です。空のままにすると「A1」のような名前になります。
                            </p>
                            <div
                                className="grid gap-2"
                                style={{ gridTemplateColumns: `repeat(${Math.min(cols, 5)}, minmax(0, 1fr))` }}
                            >
                                {regions.map((r, i) => (
                                    <input
                                        key={i}
                                        type="text"
                                        aria-label={`${Math.floor(i / cols) + 1} 行目・${(i % cols) + 1} 列目の区画の名前`}
                                        value={names[i] ?? ''}
                                        placeholder={defaultRegionName(i, cols)}
                                        maxLength={16}
                                        onChange={(e) => {
                                            const next = [...names]
                                            next[i] = e.target.value
                                            setNames(next)
                                        }}
                                        className="w-full min-w-0 rounded-xl border-2 border-ink bg-surface px-2 text-center text-lg font-bold"
                                    />
                                ))}
                            </div>
                        </fieldset>
                    </div>

                    <div>
                        <p className="pb-2 text-lg font-bold">保存後の見え方</p>
                        <div className="relative overflow-hidden rounded-xl border-2 border-ink">
                            <img src={src} alt="マップの画像" className="block w-full select-none" draggable={false} />
                            {/* 区画の境界と名前を重ねて、どこがどの名前になるかを示す */}
                            {regions.map((r, i) => (
                                <div
                                    key={i}
                                    className="pointer-events-none absolute flex items-center justify-center border border-accent"
                                    style={{
                                        left: `${r.x0}%`,
                                        top: `${r.y0}%`,
                                        width: `${r.x1 - r.x0}%`,
                                        height: `${r.y1 - r.y0}%`,
                                    }}
                                >
                                    <span className="rounded bg-surface/90 px-2 text-base font-extrabold text-ink">
                                        {r.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="pt-8">
                    {duplicated.length > 0 && (
                        <p role="alert" className="pb-3 text-lg font-bold text-accent">
                            ✕ 区画の名前が重複しています：{[...new Set(duplicated)].join('、')}
                        </p>
                    )}
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
                    <div className="flex flex-wrap gap-4">
                        <Button
                            className="min-w-64 flex-1"
                            disabled={saving || duplicated.length > 0}
                            onClick={() =>
                                setConfirm({
                                    text: `縦 ${rows} × 横 ${cols} の区画で保存しますか？`,
                                    yesText: '保存する',
                                    action: save,
                                })
                            }
                        >
                            {saving ? '保存中...' : 'この内容で保存する'}
                        </Button>
                        {!usingDefault && (
                            <Button
                                variant="secondary"
                                disabled={saving}
                                onClick={() =>
                                    setConfirm({
                                        text: '初期のマップと区画（A1〜A9）に戻しますか？',
                                        yesText: '戻す',
                                        action: reset,
                                    })
                                }
                            >
                                初期の設定に戻す
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirm !== null}
                setIsOpen={(open) => !open && setConfirm(null)}
                text={confirm?.text ?? ''}
                yesText={confirm?.yesText ?? ''}
                noText="やめる"
                setBoolean={(yes) => yes && confirm?.action()}
            />
        </div>
    )
}

export default MapSettings
