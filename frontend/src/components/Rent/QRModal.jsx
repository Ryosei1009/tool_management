import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment, useEffect, useRef } from 'react'

// 拡大プレビューの描画解像度（表示サイズとは独立）
const PREVIEW_SIZE = 720

const QRModal = ({ isOpen, setIsOpen, videoRef }) => {
    // モーダル専用のcanvas。QRReader側のrefは奪わない
    const modalCanvasRef = useRef(null)
    const rafRef = useRef(null)

    useEffect(() => {
        if (!isOpen) return

        // モーダルが開いている間、videoの映像を拡大canvasへ描画し続ける
        const draw = () => {
            const canvas = modalCanvasRef.current
            const video = videoRef.current
            if (canvas && video) {
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                }
            }
            rafRef.current = requestAnimationFrame(draw)
        }
        draw()

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [isOpen, videoRef])

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-20" onClose={() => setIsOpen(false)}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60" />
                </Transition.Child>
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="mx-auto flex w-full max-w-2xl flex-col gap-4">
                            {/* 描画解像度は固定し、表示サイズは CSS で可変にする（端末幅に依存させない） */}
                            <canvas
                                width={PREVIEW_SIZE}
                                height={PREVIEW_SIZE}
                                ref={modalCanvasRef}
                                className="block aspect-square max-h-[70vh] w-full rounded-2xl border-4 border-main bg-field object-contain"
                            />
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="min-h-touch-lg w-full rounded-xl border-2 border-surface bg-main px-8 text-xl font-extrabold text-surface"
                            >
                                閉じる
                            </button>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    )
}

export default QRModal
