import React, { useRef, useState } from 'react'
import { QRCodeCanvas } from "qrcode.react";
import PageTitle from '../Util/PageTitle'

const NewTool = () => {
    const [tool, setTool] = useState({
        name: '',
        id: ''
    })
    const qrRef = useRef(null)

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
    return (
        <div className="flex items-start justify-center min-h-[80vh] w-screen bg-base">
            <div className="w-full max-w-5xl px-6 pt-8">
                <PageTitle en="ADD TOOL">工具追加</PageTitle>

                <div className={`flex`}>
                    <div className="px-4 pt-4 w-5/6">
                        <div className="flex w-full flex-col items-center ">
                            <img className="h-64 w-64 object rounded-xl border border-line" src={'img/tmp/1.jpg'} alt="工具" />
                            <input
                                type="file"
                                accept="image/png"
                                className="mt-2 block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 file:cursor-pointer"
                                id="basic_image"
                            />
                        </div>
                    </div>
                    <div className="pt-4 pr-6 w-full flex justify-center flex-col">
                        <div className="flex flex-col gap-3 px-4.5 pt-2 pb-1.5">
                            <div className="relative flex flex-col mt-4 bg-white px-6 py-3 rounded-md border-gray-300 border-1">
                                <label className="text-lg" htmlFor="name">
                                    名前<span className="text-red-500"> *</span>
                                </label>
                                <input
                                    className="border-b-2 border-b-gray-200 focus:outline-none"
                                    onChange={(e) => setTool({ ...tool, name: e.target.value })}
                                    value={tool.name}
                                    type="text"
                                    id="name"
                                    name="name"
                                    maxLength={30}
                                    placeholder="ペンチA"
                                />
                            </div>

                            <div className="relative flex flex-col mt-4 bg-white px-6 py-3 rounded-md border-gray-300 border-1">
                                <label className="text-lg" htmlFor="id">
                                    ID<span className="text-red-500"> *</span>
                                </label>
                                <input
                                    className="border-b-2 border-b-gray-200 focus:outline-none"
                                    onChange={(e) => setTool({ ...tool, id: e.target.value })}
                                    value={tool.id}
                                    type="text"
                                    id="id"
                                    name="id"
                                    maxLength={30}
                                    placeholder="PENCH-0001"
                                />
                            </div>
                        </div>
                        <div className="hidden flex-col justify-center items-center">
                            <QRCodeCanvas
                                ref={qrRef}
                                value={tool.id}
                                size={300}
                                bgColor={"#FFFFFF"}
                                fgColor={"#000000"}
                                level={"L"}
                                includeMargin={4}
                                imageSettings={{
                                    src: "/favicon.ico",
                                    x: undefined,
                                    y: undefined,
                                    height: 24,
                                    width: 24,
                                    excavate: true,
                                }}
                                className="border-2"
                            />
                        </div>
                        <div className="px-4.5 pt-3.5 pb-4.5">
                            <button
                                onClick={handleDownload}
                                disabled={!tool.id}
                                className="text-xl w-full px-6 py-3.5 rounded-lg font-extrabold bg-main text-base disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                QRコードダウンロード
                            </button>
                        </div>
                    </div>
                </div>
                <div className="px-4.5 pt-3.5 pb-4.5">
                    <button
                        // onClick={() => setIsConfirmOpen(true)}
                        // disabled={tool.notFound}
                        className="text-xl w-full px-6 py-3.5 rounded-lg font-extrabold bg-main text-base disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        追加
                    </button>
                </div>
            </div>
        </div>
    )
}

export default NewTool