import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../Util/PageTitle'
import MapPicker from '../Util/MapPicker'
import Button from '../Util/Button'
import { fetchMe, resolveImageUrl, updateDefaultPin } from '../../api'
import { useFetch } from '../../hooks/useFetch'
import { ErrorMessage, Loading } from '../Util/AsyncState'
import { useAuth } from '../../auth/AuthContext'

// 社員情報の項目（ラベル + 値）
const InfoField = ({ label, value }) => (
    <div className="flex items-baseline gap-4 border-b-2 border-dashed border-line pb-3">
        <span className="w-24 shrink-0 text-base text-sub">{label}</span>
        <span className="text-2xl font-extrabold">{value || '―'}</span>
    </div>
)

// セクション小見出し
const SubHeading = ({ children }) => (
    <h2 className="flex items-center gap-3 pb-3 text-2xl font-extrabold">
        <span className="h-7 w-1.5 shrink-0 rounded bg-steel" aria-hidden="true" />
        {children}
    </h2>
)

// 工具を借りるときの既定の置き場所。
// 毎回マップを操作しなくて済むよう、自分の持ち場を1度だけ登録しておく。
const DefaultPinSection = ({ employee, onSaved }) => {
    const [pin, setPin] = useState(employee.defaultPin)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    useEffect(() => {
        setPin(employee.defaultPin)
    }, [employee.defaultPin])

    const changed =
        pin?.x !== employee.defaultPin?.x || pin?.y !== employee.defaultPin?.y

    const save = async (value) => {
        setSaving(true)
        setError('')
        setMessage('')
        try {
            await updateDefaultPin(value)
            setMessage(value ? '既定の置き場所を保存しました。' : '既定の置き場所を解除しました。')
            onSaved?.()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="px-5 pt-8">
            <SubHeading>工具を借りるときの置き場所</SubHeading>
            <p className="pb-4 text-base text-sub">
                ここで登録した場所が、工具を借りるときの初期値になります。自分の持ち場を選んでください。
            </p>

            <div className="max-w-xl">
                <MapPicker pin={pin} setPin={setPin} label="既定の置き場所" />
            </div>

            {message && (
                <p role="status" className="pt-4 text-lg font-bold text-state-good">
                    {message}
                </p>
            )}
            {error && (
                <p role="alert" className="pt-4 text-lg font-bold text-accent">
                    ✕ {error}
                </p>
            )}

            <div className="flex flex-wrap gap-4 pt-4">
                <Button onClick={() => save(pin)} disabled={saving || !pin || !changed}>
                    {saving ? '保存中...' : 'この場所を保存'}
                </Button>
                {employee.defaultPin && (
                    <Button
                        variant="secondary"
                        onClick={() => {
                            setPin(null)
                            save(null)
                        }}
                        disabled={saving}
                    >
                        解除する
                    </Button>
                )}
            </div>
        </div>
    )
}

const MyPage = () => {
    const load = useCallback(() => fetchMe(), [])
    const { data: employee, loading, error, reload } = useFetch(load)
    const { reload: reloadAuth } = useAuth()

    if (loading) return <Loading />
    if (error) return <ErrorMessage message={error} onRetry={reload} />

    const {
        permission = '',
        name = '',
        id = '',
        team = '',
        bloodType = '',
        photoUrl = '',
        histories = [],
    } = employee ?? {}

    return (
        <div className="flex w-full items-start justify-center bg-surface pb-nav">
            <div className="w-full max-w-5xl px-6 pt-8">
                <PageTitle en="MY PAGE">マイページ</PageTitle>

                <div className="overflow-hidden rounded-2xl border-2 border-ink bg-surface">
                    {/* セクションヘッダー：社員情報 + 権限 */}
                    <div className="flex items-center justify-between bg-main px-5 py-4">
                        <span className="text-2xl font-extrabold">社員情報</span>
                        <span className="flex items-baseline gap-3">
                            <span className="text-sm text-white/80">権限</span>
                            <span className="text-xl font-extrabold">{permission}</span>
                        </span>
                    </div>

                    {/* 顔写真 + 社員情報 */}
                    <div className="flex flex-wrap gap-6 px-5 pt-6">
                        <div className="h-56 w-44 max-w-full shrink-0 overflow-hidden rounded-xl border-2 border-ink bg-field">
                            <img
                                src={resolveImageUrl(photoUrl) || '/img/tmp/tmp_icon.png'}
                                alt={name ? `${name}の写真` : '社員写真'}
                                className="h-full w-full object-cover"
                            />
                        </div>

                        <div className="flex min-w-0 flex-1 basis-64 flex-col justify-center gap-4">
                            <InfoField label="社員名" value={name} />
                            <InfoField label="社員ID" value={id} />
                            <InfoField label="所属班" value={team} />
                            <InfoField label="血液型" value={bloodType} />
                        </div>
                    </div>

                    {/* 既定の置き場所 */}
                    {employee && (
                        <DefaultPinSection
                            employee={employee}
                            onSaved={() => {
                                reload()
                                reloadAuth()
                            }}
                        />
                    )}

                    {/* 過去の使用履歴一覧 */}
                    <div className="px-5 pt-8">
                        <SubHeading>過去の使用履歴</SubHeading>
                        <div className="max-h-64 overflow-y-auto rounded-xl border-2 border-line bg-field p-5">
                            {histories.length === 0 ? (
                                <p className="text-lg font-bold text-sub">履歴はありません</p>
                            ) : (
                                <ul className="flex flex-col gap-3">
                                    {histories.map((h, i) => (
                                        <li key={i} className="text-lg font-bold">{h}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* 管理者専用 */}
                    {permission === '管理者' && (
                        <div className="px-5 pt-8">
                            <SubHeading>管理者メニュー</SubHeading>
                            <div className="flex flex-wrap gap-4">
                                <Link
                                    to="/newtool"
                                    className="touch-target inline-flex items-center gap-3 rounded-xl border-2 border-main bg-main px-8 text-xl font-extrabold text-surface"
                                >
                                    工具を追加
                                </Link>
                                <Link
                                    to="/employees"
                                    className="touch-target inline-flex items-center gap-3 rounded-xl border-2 border-ink bg-surface px-8 text-xl font-extrabold text-ink"
                                >
                                    社員一覧
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* ヘルプ */}
                    <div className="px-5 pb-8 pt-8">
                        <SubHeading>ヘルプ</SubHeading>
                        <a
                            href="#"
                            className="touch-target inline-flex items-center text-xl font-bold text-steel underline underline-offset-4"
                        >
                            使い方ガイド・FAQ
                        </a>
                        <p className="pt-6 text-right text-base text-sub">工具管理アプリ ver1.0</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MyPage
