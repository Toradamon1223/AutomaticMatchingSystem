import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Tournament, Participant } from '../types'
import { getTournament, getParticipants, checkIn, getEntryStatus, enterTournament, cancelEntry } from '../api/tournaments'
import { useAuthStore } from '../stores/authStore'
import { format } from 'date-fns'
import BackButton from '../components/BackButton'

// 残り時間をHH:mm:SS形式で返す
function getTimeRemaining(targetDate: Date): string {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()
  
  if (diff <= 0) return '00:00:00'
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [entryStatus, setEntryStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrCode, setQrCode] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [entering, setEntering] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  useEffect(() => {
    if (id) {
      loadTournament()
      loadParticipants()
      loadEntryStatus()
    }
  }, [id])

  // カウントダウンタイマー
  useEffect(() => {
    if (!entryStatus || !entryStatus.tournament.entryStartAt || !entryStatus.tournament.entryEndAt) {
      return
    }

    const updateTimer = () => {
      const now = new Date()
      const entryStart = new Date(entryStatus.tournament.entryStartAt)
      const entryEnd = new Date(entryStatus.tournament.entryEndAt)

      if (now < entryStart) {
        // エントリー開始前
        setTimeRemaining(getTimeRemaining(entryStart))
      } else if (now >= entryStart && now <= entryEnd) {
        // エントリー期間中
        setTimeRemaining(getTimeRemaining(entryEnd))
      } else {
        // エントリー期間終了
        setTimeRemaining('00:00:00')
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [entryStatus])

  const loadTournament = async () => {
    if (!id) return
    try {
      const data = await getTournament(id)
      setTournament(data)
    } catch (error) {
      console.error('大会情報の取得に失敗しました', error)
    } finally {
      setLoading(false)
    }
  }

  const loadParticipants = async () => {
    if (!id) return
    try {
      const data = await getParticipants(id)
      setParticipants(data)
    } catch (error) {
      console.error('参加者一覧の取得に失敗しました', error)
    }
  }

  const loadEntryStatus = async () => {
    if (!id) return
    try {
      const data = await getEntryStatus(id)
      setEntryStatus(data)
    } catch (error) {
      console.error('エントリー状況の取得に失敗しました', error)
    }
  }

  const handleEntry = async () => {
    if (!id) return
    setEntering(true)
    try {
      const result = await enterTournament(id)
      alert(result.message)
      loadEntryStatus()
      loadParticipants()
    } catch (error: any) {
      alert(error.response?.data?.message || 'エントリーに失敗しました')
    } finally {
      setEntering(false)
    }
  }

  const handleCancelEntry = async () => {
    if (!id) return
    if (!confirm('エントリーをキャンセルしますか？')) return
    setCancelling(true)
    try {
      await cancelEntry(id)
      alert('エントリーをキャンセルしました')
      loadEntryStatus()
      loadParticipants()
    } catch (error: any) {
      alert(error.response?.data?.message || 'エントリーのキャンセルに失敗しました')
    } finally {
      setCancelling(false)
    }
  }

  const handleCheckIn = async () => {
    if (!id || !qrCode) return
    setCheckingIn(true)
    try {
      await checkIn(id, qrCode)
      alert('チェックインが完了しました')
      setQrCode('')
      loadParticipants()
    } catch (error: any) {
      alert(error.response?.data?.message || 'チェックインに失敗しました')
    } finally {
      setCheckingIn(false)
    }
  }

  if (loading) {
    return <div>読み込み中...</div>
  }

  if (!tournament) {
    return <div>大会が見つかりません</div>
  }

  const isParticipant = participants.some((p) => p.userId === user?.id && !p.cancelledAt)

  return (
    <div>
      <BackButton to="/tournaments" />
      <h1>{tournament.name}</h1>
      <p>{tournament.description}</p>

      {/* エントリー情報 */}
      {entryStatus && entryStatus.tournament.entryStartAt && entryStatus.tournament.entryEndAt && (
        <div style={{ marginTop: '20px' }}>
          {(() => {
            const now = new Date()
            const entryStart = new Date(entryStatus.tournament.entryStartAt)
            const entryEnd = new Date(entryStatus.tournament.entryEndAt)
            const isBeforeEntry = now < entryStart
            const isEntryPeriod = now >= entryStart && now <= entryEnd
            const isAfterEntry = now > entryEnd
            const hasEntry = entryStatus.myEntry && !entryStatus.myEntry.cancelledAt

            if (isBeforeEntry) {
              // エントリー開始前
              return (
                <button
                  disabled
                  style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    cursor: 'not-allowed',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    opacity: 0.8,
                  }}
                >
                  エントリー開始前です（開始まであと{timeRemaining}）
                </button>
              )
            } else if (isEntryPeriod) {
              if (hasEntry) {
                // エントリー済み
                return (
                  <button
                    onClick={handleCancelEntry}
                    disabled={cancelling}
                    style={{
                      padding: '10px 20px',
                      fontSize: '16px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: cancelling ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {cancelling
                      ? 'キャンセル中...'
                      : `キャンセル（キャンセル可能時間終了まで${timeRemaining}）`}
                  </button>
                )
              } else {
                // 未エントリー
                return (
                  <button
                    onClick={handleEntry}
                    disabled={entering}
                    style={{
                      padding: '10px 20px',
                      fontSize: '16px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: entering ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {entering ? 'エントリー中...' : `エントリー（終了まであと${timeRemaining}）`}
                  </button>
                )
              }
            } else if (isAfterEntry) {
              // エントリー締め切り後
              return (
                <button
                  disabled
                  style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    cursor: 'not-allowed',
                    backgroundColor: '#9e9e9e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    opacity: 0.8,
                  }}
                >
                  エントリーは締め切りました
                </button>
              )
            }
            return null
          })()}
        </div>
      )}

      {tournament.status === 'registration' && !isParticipant && (
        <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc' }}>
          <h3>チェックイン</h3>
          <p>大会で発行されたQRコードを入力してください</p>
          <input
            type="text"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            placeholder="QRコード"
            style={{ padding: '8px', marginRight: '10px', width: '300px' }}
          />
          <button onClick={handleCheckIn} disabled={checkingIn}>
            {checkingIn ? 'チェックイン中...' : 'チェックイン'}
          </button>
        </div>
      )}

      {isParticipant && tournament.status === 'in_progress' && (
        <div style={{ marginTop: '20px' }}>
          <Link to={`/tournaments/${id}/matches`}>
            <button>対戦情報を見る</button>
          </Link>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <h2>
          参加者一覧 ({participants.length}
          {entryStatus?.tournament.capacity ? `/${entryStatus.tournament.capacity}` : ''}名)
        </h2>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '15px',
            border: '1px solid #ddd',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>エントリーNo.</th>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>参加者名</th>
              <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>エントリー日付</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant, index) => (
              <tr key={participant.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '12px', border: '1px solid #ddd' }}>{index + 1}</td>
                <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                  {participant.user.name}
                  {participant.checkedIn && ' ✓'}
                  {participant.dropped && ' (棄権)'}
                </td>
                <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                  {participant.enteredAt
                    ? format(new Date(participant.enteredAt), 'yyyy年MM月dd日 HH:mm')
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(user?.role === 'organizer' || user?.role === 'admin') &&
        tournament.organizerId === user?.id && (
          <div style={{ marginTop: '30px' }}>
            <Link to={`/tournaments/${id}/admin`}>
              <button>管理画面</button>
            </Link>
          </div>
        )}
    </div>
  )
}

