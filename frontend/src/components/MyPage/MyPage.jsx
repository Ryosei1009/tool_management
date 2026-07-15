import React from 'react'
import { sampleEmployee } from '../../data/sampleData'
import { Link } from 'react-router-dom'
import PageTitle from '../Util/PageTitle'

// 社員情報の項目（ラベル + 値）— 点線区切りスタイル
const InfoField = ({ label, value }) => (
    <div className="flex items-baseline gap-3 pb-2.5 border-b border-dashed border-line">
        <span className="w-16 text-xs text-sub">{label}</span>
        <span className="font-semibold">{value}</span>
    </div>
)

// セクション小見出し（左にスチールブルーのアクセントバー）
const SubHeading = ({ children }) => (
    <h2 className="flex items-center gap-2 pb-2 text-lg font-semibold">
        <span className="h-4 w-1 shrink-0 rounded bg-steel" aria-hidden="true" />
        {children}
    </h2>
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
            <div className="w-full max-w-5xl px-6 pt-8">
                <PageTitle en="MY PAGE">マイページ</PageTitle>

                <div className="bg-base border border-line rounded-2xl overflow-hidden">
                    {/* ネイビーのセクションヘッダー：社員情報 + 権限 */}
                    <div className="flex items-center justify-between bg-main px-4 py-3">
                        <span className="text-lg font-semibold">社員情報</span>
                        <span className="flex items-baseline gap-3">
                            <span className="text-xs text-white/70">権限</span>
                            <span className="font-semibold">{permission}</span>
                        </span>
                    </div>

                    {/* 顔写真 + 社員情報 */}
                    <div className="flex px-4.5 pt-5">
                        <div className="h-56 w-44 shrink-0 overflow-hidden rounded-xl border border-line bg-line">
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
                        <SubHeading>過去の使用履歴一覧</SubHeading>
                        <div className="h-32 overflow-y-auto rounded-xl border border-line bg-base p-4">
                            <ul className="flex flex-col gap-2">
                                {histories.map((h, i) => (
                                    <li key={i} className="font-semibold">{h}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* 管理者専用 */}
                    <div className="px-4.5 pt-6">
                        <SubHeading>管理者専用</SubHeading>
                        <Link
                            to="/newtool"
                            className="block pb-2.5 mb-2.5 border-b border-dashed border-line font-semibold text-main underline underline-offset-4"
                        >
                            工具追加
                        </Link>
                        <Link
                            to="/newtool"
                            className="block pb-2.5 border-b border-dashed border-line font-semibold text-main underline underline-offset-4"
                        >
                            社員一覧
                        </Link>
                    </div>

                    {/* ヘルプ */}
                    <div className="px-4.5 pt-6 pb-6">
                        <SubHeading>ヘルプ</SubHeading>
                        <a
                            href="#"
                            className="block pb-2.5 border-b border-dashed border-line font-semibold text-main underline underline-offset-4"
                        >
                            使い方ガイド・FAQ
                        </a>
                        <p className="pt-4 text-right text-sub text-sm">工具管理アプリ ver1.0</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MyPage
