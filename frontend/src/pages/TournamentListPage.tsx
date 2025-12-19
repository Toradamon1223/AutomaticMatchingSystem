import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tournament } from '../types'
import { getTournaments, getEntryStatus } from '../api/tournaments'
import { useAuthStore } from '../stores/authStore'

interface TournamentWithEntryStatus extends Tournament {
  entryStatus?: {
    isEntryPeriod: boolean
    myEntry: {
      id: string
      enteredAt: string
      isWaitlist: boolean
      cancelledAt: string | null
    } | null
  }
}

export default function TournamentListPage() {
  const { user } = useAuthStore()
  const [tournaments, setTournaments] = useState<TournamentWithEntryStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTournaments()
  }, [])

  const loadTournaments = async () => {
    try {
      const data = await getTournaments()
      // 各大会のエントリー状況を取得
      const tournamentsWithStatus = await Promise.all(
        data.map(async (tournament) => {
          try {
            const entryStatus = await getEntryStatus(tournament.id)
            return {
              ...tournament,
              entryStatus: {
                isEntryPeriod: entryStatus.isEntryPeriod,
                myEntry: entryStatus.myEntry,
              },
            }
          } catch {
            return tournament
          }
        })
      )
      setTournaments(tournamentsWithStatus)
    } catch (error) {
      console.error('大会一覧の取得に失敗しました', error)
    } finally {
      setLoading(false)
    }
  }

  const getEntryStatusText = (tournament: TournamentWithEntryStatus) => {
    if (!tournament.entryStatus) return null

    const { myEntry } = tournament.entryStatus

    if (!myEntry) {
      return 'エントリー未済み'
    }
    if (myEntry.cancelledAt) {
      return 'エントリー未済み'
    }
    if (myEntry.isWaitlist) {
      return 'キャンセル待ち'
    }
    return 'エントリー済み'
  }

  const getEntryStatusColor = (tournament: TournamentWithEntryStatus) => {
    if (!tournament.entryStatus) return '#999'

    const { myEntry } = tournament.entryStatus

    if (!myEntry || myEntry.cancelledAt) {
      return '#f44336' // 赤: エントリー未済み
    }
    if (myEntry.isWaitlist) {
      return '#FF9800' // オレンジ: キャンセル待ち
    }
    return '#2196F3' // 青: エントリー済み
  }

  const getTournamentStatusText = (tournament: TournamentWithEntryStatus) => {
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

  return (
    <div>
      {loading ? (
        <p>読み込み中...</p>
      ) : tournaments.length === 0 ? (
        <p>現在参加可能な大会はありません</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px',
            listStyle: 'none',
            padding: 0,
          }}
        >
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '15px',
              }}
            >
              <Link to={`/tournaments/${tournament.id}`}>
                <h3>{tournament.name}</h3>
              </Link>
              <p>{tournament.description}</p>
              {tournament.eventDate && (
                <p>
                  <strong>開催日:</strong>{' '}
                  {new Date(tournament.eventDate).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
              {tournament.registrationTime && (
                <p>
                  <strong>受付時間:</strong>{' '}
                  {new Date(tournament.registrationTime).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {tournament.startTime && (
                <p>
                  <strong>開始時間:</strong>{' '}
                  {new Date(tournament.startTime).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              <p>
                <strong>大会ステータス:</strong>{' '}
                {getTournamentStatusText(tournament)}
              </p>
              {tournament.entryStatus && (
                <p>
                  <strong>エントリー状況:</strong>{' '}
                  <span
                    style={{
                      color: getEntryStatusColor(tournament),
                      fontWeight: 'bold',
                    }}
                  >
                    {getEntryStatusText(tournament)}
                  </span>
                </p>
              )}
              {(user?.role === 'organizer' || user?.role === 'admin') &&
                tournament.organizerId === user?.id && (
                  <Link to={`/tournaments/${tournament.id}/admin`}>
                    <button>管理画面</button>
                  </Link>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

