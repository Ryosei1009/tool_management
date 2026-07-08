import { Dialog, Transition } from '@headlessui/react'
import React, { Fragment, useEffect, useRef } from 'react'

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
                    <div className="fixed inset-0 bg-black/25" />
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
                        <Dialog.Panel className="relative max-w-5xl mx-auto">
					        <canvas width={window.innerHeight * 0.8} height={window.innerHeight * 0.8} ref={modalCanvasRef} className={`border-accent border-8 rounded-2xl`} />
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    )
}

export default QRModal
