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

    // 結果発表
    if (tournament.status === 'completed') {
      return '結果発表'
    }

    // 大会開催中
    if (tournament.status === 'in_progress') {
      return '大会開催中'
    }

    // 大会開催準備中
    if (tournament.status === 'preparing') {
      return '大会開催準備中'
    }

    // エントリー期間の判定
    if (tournament.entryStartAt && tournament.entryEndAt) {
      const entryStart = new Date(tournament.entryStartAt)
      const entryEnd = new Date(tournament.entryEndAt)

      if (now < entryStart) {
        return 'エントリー開始前'
      }
      if (now >= entryStart && now <= entryEnd) {
        return 'エントリー受付中'
      }
      if (now > entryEnd) {
        return 'エントリー締め切り'
      }
    }

    // エントリー期間が設定されていない場合
    if (tournament.status === 'registration') {
      return 'エントリー受付中'
    }

    // エントリー開始前（デフォルト）
    if (tournament.status === 'draft') {
      return 'エントリー開始前'
    }

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
    if (tournament.status === 'preparing') {
      return '#9C27B0'
    }
    if (participant.isWaitlist) {
      return '#FF9800'
    }
    return '#2196F3'
  }

  return (
    <div>
      <p>ようこそ、{user?.name}さん</p>

      {/* 大会作成ボタン（主催者または管理者のみ） */}
      {(user?.role === 'organizer' || user?.role === 'admin') && (
        <div style={{ marginTop: '20px', marginBottom: '30px' }}>
          <Link
            to="/tournaments/new"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#2196F3',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '16px',
            }}
          >
            + 新しい大会を作成
          </Link>
        </div>
      )}

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

