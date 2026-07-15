import jsQR from 'jsqr'
import React, { useEffect, useRef, useState } from 'react'
import QRModal from './QRModal'

// isScanning が true の間だけQRスキャンを行う。
// 借りるモーダルが開いている間は false になり、閉じると true に戻って再開する。
const QRReader = ({ onScan, isScanning = true }) => {
	const videoRef = useRef(null)
	const canvasRef = useRef(null)
	const timerRef = useRef(null)
	const loopRunningRef = useRef(false) // スキャンループの多重起動防止
	const scanningRef = useRef(isScanning) // 最新の isScanning をループ内から参照
	const armedRef = useRef(true) // 次の検出でトリガーしてよいか
	const lastCodeRef = useRef(null) // 直前に読み取ったコード
	const [error, setError] = useState('')
	const [isModalOpen, setIsModalOpen] = useState(false)

	// 最新の isScanning をループ内から参照できるよう保持
	useEffect(() => {
		scanningRef.current = isScanning
	}, [isScanning])

	// カメラの初期化（マウント時に一度だけ）
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
				// カメラにアクセスできたら、video要素にストリームをセットしてスキャン開始
				if (videoRef.current) {
					videoRef.current.srcObject = stream
					videoRef.current.play()
					startScan()
				}
			})
			.catch((err) => {
				console.error('Error accessing media devices:', err)
				setError('カメラを起動できませんでした。右の検索から工具を選べます。')
			})

		const currentVideoRef = videoRef.current

		// アンマウント時にスキャンを止め、カメラのストリームを停止する
		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current)
			}
			loopRunningRef.current = false
			if (currentVideoRef && currentVideoRef.srcObject) {
				const stream = currentVideoRef.srcObject
				stream.getTracks().forEach((track) => track.stop())
			}
		}
	}, [])

	// isScanning が true になったら（＝モーダルが閉じたら）スキャンを再開する
	useEffect(() => {
		if (isScanning) {
			startScan()
		}
	}, [isScanning])

	// スキャンループを開始（多重起動・カメラ未準備・停止中は何もしない）
	const startScan = () => {
		if (loopRunningRef.current) return
		if (!videoRef.current?.srcObject) return
		if (!scanningRef.current) return
		loopRunningRef.current = true
		scanQrCode()
	}

	const scanQrCode = () => {
		// 停止指示が出ていればループを終える
		if (!scanningRef.current) {
			loopRunningRef.current = false
			return
		}

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
					const code = qrCodeData.data
					// 同じQRが写り続けている間の即再オープンを防ぐ。
					// 一度画面から外れて armed が戻るか、別のコードなら再トリガー。
					if (armedRef.current || code !== lastCodeRef.current) {
						lastCodeRef.current = code
						armedRef.current = false
						loopRunningRef.current = false
						setIsModalOpen(false)
						console.log('QR Code Data:', code)
						onScan(code)
						return
					}
				} else {
					// QRが画面から外れたら、次の検出で再びトリガーできるようにする
					armedRef.current = true
				}
			}
		}
		timerRef.current = setTimeout(scanQrCode, 1000 / 30)
	}

	return (
		<>
			<div className='-mt-12 flex justify-center items-center h-full'>
				{error ? (
					<div className='max-w-xs px-6 text-center text-sub font-semibold'>
						{error}
					</div>
				) : (
					<div className='relative'>
						<video ref={videoRef} autoPlay playsInline className='absolute left-0 top-0 -z-50 h-75 w-75' />
						<canvas onClick={() => { setIsModalOpen(true) }} width={window.innerWidth * 0.4} height={window.innerWidth * 0.4} ref={canvasRef} className={`border-main border-4 rounded-2xl`} />
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
