import React, { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import QRReader from './QRReader'
import RentInput from './RentModal'
import ToolSearch from './ToolSearch'

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
        <div className={`flex items-center h-screen w-screen`}>
            <div className={`w-1/2 bg-base h-full pb-24`}>
                <div className="text-6xl font-bold text-center pt-8">
                    工具を借りる
                </div>
                <QRReader setResult={setResult} />
            </div>
            <div className={`w-1/2 bg-base h-full border-l border-line pb-24`}>
                <ToolSearch setResult={setResult} />
            </div>
        </div>
        <RentInput isOpen={isModalOpen} setIsOpen={setIsModalOpen} toolId={result} />
        </>
    )
}

export default Rent