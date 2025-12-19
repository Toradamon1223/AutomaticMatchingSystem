import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Tournament } from '../types'
import { getMyParticipations } from '../api/tournaments'

interface MyParticipation {
  tournament: Tournament
  participant: {
    id: string
    enteredAt: string
    isWaitlist: boolean
    cancelledAt: string | null
    checkedIn: boolean
  }
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [myParticipations, setMyParticipations] = useState<MyParticipation[]>([])
  const [loadingParticipations, setLoadingParticipations] = useState(true)

  useEffect(() => {
    // 最新のユーザー情報を取得
    useAuthStore.getState().checkAuth()
    loadMyParticipations()
  }, [])

  const loadMyParticipations = async () => {
    try {
      const data = await getMyParticipations()
      setMyParticipations(data)
    } catch (error) {
      console.error('参加大会の取得に失敗しました', error)
    } finally {
      setLoadingParticipations(false)
    }
  }

  const getTournamentStatusText = (tournament: Tournament) => {
    const now = new Date()

    // 大会終了
    if (tournament.status === 'completed') {
      return '大会終了'
    }

    // 開催中
    if (tournament.status === 'in_progress') {
      return '開催中'
    }

    // エントリー期間の判定
    if (tournament.entryStartAt && tournament.entryEndAt) {
      const entryStart = new Date(tournament.entryStartAt)
      const entryEnd = new Date(tournament.entryEndAt)

      if (now < entryStart) {
        return 'エントリー期間前'
      }
      if (now >= entryStart && now <= entryEnd) {
        return 'エントリー受付中'
      }
      if (now > entryEnd && tournament.status === 'registration') {
        return 'エントリー締め切り'
      }
    }

    // エントリー期間が設定されていない場合
    if (tournament.status === 'registration') {
      return 'エントリー受付中'
    }

    // 準備中
    return '準備中'
  }

  const getStatusText = (participation: MyParticipation) => {
    const { tournament, participant } = participation

    // 大会ステータスを取得
    const tournamentStatus = getTournamentStatusText(tournament)

    // エントリー状況（エントリー済みのもののみ表示される）
    if (participant.isWaitlist) {
      return `${tournamentStatus}（キャンセル待ち）`
    }
    return tournamentStatus
  }

  const getStatusColor = (participation: MyParticipation) => {
    const { tournament, participant } = participation

    if (tournament.status === 'completed') {
      return '#999'
    }
    if (tournament.status === 'in_progress') {
      return '#4CAF50'
    }
    if (participant.isWaitlist) {
      return '#FF9800'
    }
    return '#2196F3'
  }

  return (
    <div>
      <p>ようこそ、{user?.name}さん</p>

      <div style={{ marginTop: '30px' }}>
        <h2>参加した大会</h2>
        {loadingParticipations ? (
          <p>読み込み中...</p>
        ) : myParticipations.length === 0 ? (
          <p>参加した大会はありません</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {myParticipations.map((participation) => (
              <li
                key={participation.tournament.id}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '10px',
                }}
              >
                <Link to={`/tournaments/${participation.tournament.id}`}>
                  <h3>{participation.tournament.name}</h3>
                </Link>
                <p>{participation.tournament.description}</p>
                <p>
                  <strong>ステータス:</strong>{' '}
                  <span style={{ color: getStatusColor(participation), fontWeight: 'bold' }}>
                    {getStatusText(participation)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

