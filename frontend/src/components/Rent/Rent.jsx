import React, { useState } from 'react'
import QRReader from './QRReader'
import RentModal from './RentModal'
import ToolSearch from './ToolSearch'
import PageTitle from '../Util/PageTitle'

// 借りる画面。
// 「QRを読む」「一覧から選ぶ」の2通りを常に並べて出し、
// カメラが使えない環境でも操作が止まらないようにする。
const Rent = () => {
    const [result, setResult] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    // 貸出後に検索リストを取り直すためのキー
    const [reloadKey, setReloadKey] = useState(0)
    const [message, setMessage] = useState('')

    // QR検出・検索選択のたびにモーダルを開く（同じ工具の再読み取りでも開く）
    const handleSelect = (id) => {
        setResult(id)
        setIsModalOpen(true)
    }

    return (
        <>
            <div className="w-full bg-surface pb-nav">
                <div className="px-6 pt-6">
                    <PageTitle en="RENT" description="">
                        工具を借りる
                    </PageTitle>
                    {message && (
                        <p role="status" className="mb-4 text-lg font-bold text-state-good">
                            {message}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-stretch">
                    <div className="w-full lg:w-1/2">
                        <h2 className="px-6 pb-2 text-2xl font-extrabold">
                            QRコードを読み取る
                        </h2>
                        {/* モーダルが閉じている間だけスキャンする */}
                        <QRReader onScan={handleSelect} isScanning={!isModalOpen} />
                    </div>
                    <div className="w-full border-t-4 border-line lg:w-1/2 lg:border-l-4 lg:border-t-0">
                        {/* <h2 className="px-6 pb-2 text-2xl font-extrabold">
                            工具検索
                        </h2> */}
                        <ToolSearch key={reloadKey} setResult={handleSelect} />
                    </div>
                </div>
            </div>
            <RentModal
                isOpen={isModalOpen}
                setIsOpen={setIsModalOpen}
                toolId={result}
                onRented={({ mode, toolName, proxyName }) => {
                    setReloadKey((k) => k + 1)
                    setMessage(
                        `${toolName} を${proxyName ? `${proxyName} さんの代わりに` : ''}${
                            mode === 'rent' ? '借りました。' : '予約しました。'
                        }「借りているもの」で確認できます。`
                    )
                }}
            />
        </>
    )
}

export default Rent
