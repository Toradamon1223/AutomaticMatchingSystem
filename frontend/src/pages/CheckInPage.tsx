import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { checkIn } from '../api/tournaments'
import BackButton from '../components/BackButton'

export default function CheckInPage() {
  const { id } = useParams<{ id: string }>()
  const [qrCode, setQrCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            html5QrCodeRef.current?.clear()
          })
          .catch(() => {})
      }
    }
  }, [])

  const startScanning = async () => {
    if (!id) return

    try {
      const html5QrCode = new Html5Qrcode('reader')
      html5QrCodeRef.current = html5QrCode
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          setScanning(false)
          await html5QrCode.stop()
          html5QrCode.clear()
          html5QrCodeRef.current = null
          try {
            await checkIn(id, decodedText)
            alert('チェックインが完了しました')
            setQrCode('')
            setError('')
          } catch (err: any) {
            setError(err.response?.data?.message || 'チェックインに失敗しました')
          }
        },
        (errorMessage) => {
          // スキャンエラーは無視（継続スキャン）
        }
      )
      setScanning(true)
    } catch (err) {
      setError('カメラへのアクセスに失敗しました')
      setScanning(false)
    }
  }

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
        html5QrCodeRef.current = null
      } catch (err) {
        // エラーは無視
      }
    }
    setScanning(false)
  }

  const handleManualCheckIn = async () => {
    if (!id || !qrCode) return
    try {
      await checkIn(id, qrCode)
      alert('チェックインが完了しました')
      setQrCode('')
      setError('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'チェックインに失敗しました')
    }
  }

  return (
    <div>
      <BackButton to={id ? `/tournaments/${id}` : '/'} />
      <h1>チェックイン</h1>

      <div style={{ marginTop: '20px' }}>
        <h2>QRコードスキャン</h2>
        <div id="reader" style={{ width: '100%', maxWidth: '500px', margin: '20px auto' }}></div>
        {!scanning ? (
          <button onClick={startScanning}>スキャンを開始</button>
        ) : (
          <button onClick={stopScanning}>スキャンを停止</button>
        )}
      </div>

      <div style={{ marginTop: '40px' }}>
        <h2>手動入力</h2>
        <input
          type="text"
          value={qrCode}
          onChange={(e) => setQrCode(e.target.value)}
          placeholder="QRコードを入力"
          style={{ padding: '8px', marginRight: '10px', width: '300px' }}
        />
        <button onClick={handleManualCheckIn}>チェックイン</button>
      </div>

      {error && <div style={{ color: 'red', marginTop: '20px' }}>{error}</div>}
    </div>
  )
}

