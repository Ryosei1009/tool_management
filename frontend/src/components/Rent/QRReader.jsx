import jsQR from 'jsqr'
import React, { useEffect, useRef, useState } from 'react'
import QRModal from './QRModal'

const QRReader = ({ setResult }) => {
	const videoRef = useRef(null)
	const canvasRef = useRef(null)
	const rafRef = useRef(null)
	const scanCounterRef = useRef(0)
	const [error, setError] = useState('')
	const [isModalOpen, setIsModalOpen] = useState(false)

	useEffect(() => {
		const constraints = {
			video: {
				facingMode: 'environment',
				width: { ideal: 300 },
				height: { ideal: 300 },
			},
		}

		// mediaDevices はセキュアコンテキスト（HTTPS または localhost）でのみ利用可能。
		// iPad等に http でアクセスした場合は undefined になるため、ここでガードする。
		if (!navigator.mediaDevices?.getUserMedia) {
			setError('このページではカメラを利用できません（HTTPS でアクセスしてください）。右の検索から工具を選べます。')
			return
		}

		// デバイスのカメラにアクセスする
		navigator.mediaDevices
			.getUserMedia(constraints)
			.then((stream) => {
				// デバイスのカメラにアクセスすることに成功したら、video要素にストリームをセットする
				if (videoRef.current) {
					videoRef.current.srcObject = stream
					videoRef.current.play()
					scanQrCode()
				}
			})
			.catch((err) => {
				console.error('Error accessing media devices:', err)
				setError('カメラを起動できませんでした。右の検索から工具を選べます。')
			})

		const currentVideoRef = videoRef.current

		// コンポーネントがアンマウントされたら、カメラのストリームを停止する
		return () => {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current)
			}
			if (currentVideoRef && currentVideoRef.srcObject) {
				const stream = currentVideoRef.srcObject
				const tracks = stream.getTracks()
				tracks.forEach((track) => track.stop())
			}
		}
	}, [])

	const scanQrCode = () => {
		const canvas = canvasRef.current
		const video = videoRef.current
		if (canvas && video) {
			const ctx = canvas.getContext('2d', { willReadFrequently: true })
			if (ctx) {
				// カメラの映像をcanvasに描画する
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
				// QRコードをスキャンする（反転パターンは試さず処理を軽くする）
				const qrCodeData = jsQR(imageData.data, imageData.width, imageData.height, {
					inversionAttempts: 'dontInvert',
				})
				if (qrCodeData) {
					// スキャンされた内容を確認する
					setResult(qrCodeData.data)
					setIsModalOpen(false)
					console.log('QR Code Data:', qrCodeData.data)
					return
				}
				setTimeout(scanQrCode, 1000 / 30)
			}
		}
	}

	return (
		<>
			<div className='flex justify-center items-center h-full'>
				{error ? (
					<div className='max-w-xs px-6 text-center text-sub font-semibold'>
						{error}
					</div>
				) : (
					<div className='relative'>
						<video ref={videoRef} autoPlay playsInline className='absolute left-0 top-0 -z-50 h-75 w-75' />
						<canvas onClick={() => { setIsModalOpen(true) }} width={window.innerWidth * 0.4} height={window.innerWidth * 0.4} ref={canvasRef} className={`border-accent border-8 rounded-2xl`} />
						<div className={`text-xl font-bold`}>
							クリックで拡大
						</div>
					</div>
				)}
			</div>
			<QRModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} videoRef={videoRef} />
		</>
	)
}

export default QRReader