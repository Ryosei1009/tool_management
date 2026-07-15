import React, { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import QRReader from './QRReader'
import RentInput from './RentModal'
import ToolSearch from './ToolSearch'
import PageTitle from '../Util/PageTitle'

const Rent = () => {
    const [result, setResult] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    useEffect(() => {
        if (result) {
            setIsModalOpen(true)
        }
    }, [result])

    return (
        <>
        <div className={`flex items-stretch min-h-[calc(100vh-3.5rem)] w-screen`}>
            <div className={`w-1/2 bg-base pb-24`}>
                <div className="px-6 pt-8">
                    <PageTitle en="RENT">工具を借りる</PageTitle>
                </div>
                <QRReader setResult={setResult} />
            </div>
            <div className={`w-1/2 pb-24 bg-base border-l border-line`}>
                <ToolSearch setResult={setResult} />
            </div>
        </div>
        <RentInput isOpen={isModalOpen} setIsOpen={setIsModalOpen} toolId={result} />
        </>
    )
}

export default Rent