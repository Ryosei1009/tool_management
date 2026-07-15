import React, { useState } from 'react'
import QRReader from './QRReader'
import RentInput from './RentModal'
import ToolSearch from './ToolSearch'
import PageTitle from '../Util/PageTitle'

const Rent = () => {
    const [result, setResult] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)

    // QR検出・検索選択のたびにモーダルを開く（同じ工具の再読み取りでも開く）
    const handleSelect = (id) => {
        setResult(id)
        setIsModalOpen(true)
    }

    return (
        <>
        <div className={`flex items-stretch min-h-[calc(100vh-3.5rem)] w-screen`}>
            <div className={`w-1/2 bg-base pb-24`}>
                <div className="px-6 pt-8">
                    <PageTitle en="RENT">工具を借りる</PageTitle>
                </div>
                {/* モーダルが閉じている間だけスキャンする */}
                <QRReader onScan={handleSelect} isScanning={!isModalOpen} />
            </div>
            <div className={`w-1/2 pb-24 bg-base border-l border-line`}>
                <ToolSearch setResult={handleSelect} />
            </div>
        </div>
        <RentInput isOpen={isModalOpen} setIsOpen={setIsModalOpen} toolId={result} />
        </>
    )
}

export default Rent