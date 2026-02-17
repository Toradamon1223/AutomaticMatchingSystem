import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tournament } from '../types'
import { getTournaments, getEntryStatus } from '../api/tournaments'
import { parseJSTISOString, getJSTNow } from '../utils/dateUtils'

function resolveLogoUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/tournaments/')) {
    const apiBase = import.meta.env.VITE_API_URL || '/Tournament/api'
    return `${apiBase}${url}`
  }
  return url
}

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
      return '未エントリー'
    }
    if (myEntry.cancelledAt) {
      return '未エントリー'
    }
    if (
      myEntry.isWaitlist &&
      (tournament.status === 'registration' ||
        tournament.status === 'preparing' ||
        tournament.status === 'draft')
    ) {
      return 'キャンセル待ち'
    }
    return 'エントリー済み'
  }

  const getEntryStatusColor = (tournament: TournamentWithEntryStatus) => {
    if (!tournament.entryStatus) return '#999'

    const { myEntry } = tournament.entryStatus

    if (!myEntry || myEntry.cancelledAt) {
      return '#f44336' // 赤: 未エントリー
    }
    if (
      myEntry.isWaitlist &&
      (tournament.status === 'registration' ||
        tournament.status === 'preparing' ||
        tournament.status === 'draft')
    ) {
      return '#FF9800' // オレンジ: キャンセル待ち
    }
    return '#2196F3' // 青: エントリー済み
  }

  const getTournamentStatusText = (tournament: TournamentWithEntryStatus) => {
    const now = getJSTNow()

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
      const entryStart = parseJSTISOString(tournament.entryStartAt)
      const entryEnd = parseJSTISOString(tournament.entryEndAt)

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

  const getStatusBadgeColor = (tournament: TournamentWithEntryStatus) => {
    const status = getTournamentStatusText(tournament)
    if (status === '結果発表') return '#999'
    if (status === '大会開催中') return '#4CAF50'
    if (status === '大会開催準備中') return '#9C27B0'
    if (status === 'エントリー受付中') return '#2196F3'
    if (status === 'エントリー開始前') return '#FF9800'
    if (status === 'エントリー締め切り') return '#f44336'
    return '#999'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    const date = parseJSTISOString(dateString)
    // parseJSTISOStringは既にローカル時刻として扱っているので、そのまま使用
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} (${weekdays[date.getDay()]})`
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px' }}>大会一覧</h1>
      {loading ? (
        <p>読み込み中...</p>
      ) : tournaments.length === 0 ? (
        <p>現在参加可能な大会はありません</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
            listStyle: 'none',
            padding: 0,
          }}
          className="tournament-grid"
        >
          {tournaments.map((tournament) => (
            <Link
              key={tournament.id}
              to={`/tournaments/${tournament.id}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <div
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                {/* ロゴ画像バナー */}
                <div
                  style={{
                    width: '100%',
                    height: '180px',
                    backgroundColor: '#f5f5f5',
                    backgroundImage: resolveLogoUrl(tournament.logoImageUrl) ? `url(${resolveLogoUrl(tournament.logoImageUrl)})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    position: 'relative',
                  }}
                >
                  {/* ステータスバッジ */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      backgroundColor: getStatusBadgeColor(tournament),
                      color: '#fff',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {getTournamentStatusText(tournament)}
                  </div>
                </div>

                {/* カード内容 */}
                <div style={{ padding: '16px' }}>
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#333',
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {tournament.name}
                  </h3>

                  {/* 開催日 */}
                  <div style={{ marginBottom: '8px', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📅</span>
                    <span>{tournament.eventDate ? formatDate(tournament.eventDate) : '未設定'}</span>
                  </div>

                  {/* 会場 */}
                  <div style={{ marginBottom: '8px', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📍</span>
                    <span>{tournament.venueName || '未設定'}</span>
                  </div>

                  {/* 参加費 */}
                  <div style={{ marginBottom: '8px', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💰</span>
                    <span>
                      {tournament.entryFee !== undefined && tournament.entryFee !== null
                        ? tournament.entryFee === 0
                          ? '無料'
                          : `¥${tournament.entryFee.toLocaleString()}`
                        : '未設定'}
                    </span>
                  </div>

                  {/* エントリー状況 */}
                  <div style={{ marginBottom: '8px', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>👥</span>
                    <span>{tournament.participantCount || 0}/{tournament.capacity || '無制限'}人</span>
                  </div>

                  {/* 主催 */}
                  <div style={{ marginBottom: '8px', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>👨</span>
                    <span>{tournament.organizer.name}</span>
                  </div>

                  {/* エントリー状況 */}
                  {tournament.entryStatus && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '8px',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '6px',
                        fontSize: '13px',
                        textAlign: 'center',
                        color: getEntryStatusColor(tournament),
                        fontWeight: 'bold',
                      }}
                    >
                      {getEntryStatusText(tournament)}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .tournament-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }
        @media (max-width: 480px) {
          .tournament-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  )
}
