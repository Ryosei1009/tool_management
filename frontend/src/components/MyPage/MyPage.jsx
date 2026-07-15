import React from 'react'
import { sampleEmployee } from '../../data/sampleData'
import { Link } from 'react-router-dom'

// 社員情報の項目（ラベル + 値）— 借りる画面の入力欄と同じ点線区切りスタイル
const InfoField = ({ label, value }) => (
    <div className="flex items-baseline gap-3 pb-2.5 border-b border-dashed border-line">
        <span className="w-16 text-xs">{label}</span>
        <span className="font-semibold">{value}</span>
    </div>
)

const MyPage = ({ employee = sampleEmployee }) => {
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
        <div className="flex items-start justify-center min-h-screen w-screen bg-base pb-24">
            <div className="w-full max-w-5xl bg-base border-main border-4 rounded-2xl overflow-hidden mt-8">
                {/* ヘッダー：権限 */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-line">
                    <span className="text-lg font-semibold">マイページ</span>
                    <span className="flex items-baseline gap-3">
                        <span className="text-xs">権限</span>
                        <span className="font-semibold">{permission}</span>
                    </span>
                </div>

                {/* 顔写真 + 社員情報 */}
                <div className="flex px-4.5 pt-4">
                    <div className="h-56 w-44 shrink-0 overflow-hidden rounded-xl border border-main bg-accent/20">
                        {photoUrl && (
                            <img
                                src={photoUrl}
                                alt={name ? `${name}の写真` : '社員写真'}
                                className="h-full w-full object-cover"
                            />
                        )}
                    </div>

                    <div className="flex flex-1 flex-col justify-center gap-3 px-6">
                        <InfoField label="社員名" value={name} />
                        <InfoField label="社員ID" value={id} />
                        <InfoField label="所属班" value={team} />
                        <InfoField label="血液型" value={bloodType} />
                    </div>
                </div>

                {/* 過去の使用履歴一覧 */}
                <div className="px-4.5 pt-6">
                    <h2 className="text-lg font-semibold pb-2">過去の使用履歴一覧</h2>
                    <div className="h-32 overflow-y-auto rounded-xl border border-main p-4">
                        <ul className="flex flex-col gap-2">
                            {histories.map((h, i) => (
                                <li key={i} className="font-semibold">{h}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="px-4.5 pt-6 pb-6">
                    <h2 className="text-lg font-semibold pb-2">管理者専用</h2>
                    <Link
                        key='/newtool'
                        to='/newtool'
                        className="block mb-2.5 font-semibold"
                    >
                        <span className="border-b text-blue-500">
                            工具追加
                        </span>
                    </Link>
                    <Link
                        key='/newtool'
                        to='/newtool'
                        className="block mb-2.5 font-semibold"
                    >
                        <span className="border-b text-blue-500">
                            社員一覧
                        </span>
                    </Link>
                    <div className="border-b border-dashed border-line" />
                </div>

                {/* ヘルプ */}
                <div className="px-4.5 pt-6 pb-6">
                    <h2 className="text-lg font-semibold pb-2">ヘルプ</h2>
                    <a
                        href="#"
                        className="block pb-2.5 border-b border-dashed border-line font-semibold"
                    >
                        使い方ガイド・FAQ
                    </a>
                    <p className="pt-4 text-right text-sub text-sm">工具管理アプリ ver1.0</p>
                </div>
            </div>
        </div>
    )
}

export default MyPage
