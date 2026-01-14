import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Tournament, Participant, Match } from '../types'
import {
  getTournament,
  getParticipants,
  checkIn,
  getEntryStatus,
  enterTournament,
  cancelEntry,
  getMatches,
  getAnnouncement,
  updateAnnouncement,
  updateTournament,
  toggleParticipantCheckIn,
  addGuestParticipant,
  forceCancelParticipant,
  startTournament,
  rematchRound1,
  reportMatchResult,
  getStandings,
  createNextRound,
  startRound,
  rematchRound,
  resetTournament,
  checkPreliminaryCompleted,
  announcePreliminaryStandings,
  createTournamentBracket,
  getTournamentBracket,
  resetTournamentBracket,
  TournamentBracket,
} from '../api/tournaments'
import { useAuthStore } from '../stores/authStore'
import { format } from 'date-fns'
import BackButton from '../components/BackButton'
import {
  parseJSTISOString,
  getJSTNow,
  combineDateAndTime,
  getDatePart,
  getTimePart,
} from '../utils/dateUtils'

// ダークモード検出フック
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => setIsDark(e.matches)

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isDark
}

// 残り時間をHH:mm:SS形式で返す
function getTimeRemaining(targetDate: Date): string {
  const now = getJSTNow()
  const diff = targetDate.getTime() - now.getTime()

  if (diff <= 0) return '00:00:00'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

type TabType = 'details' | 'participants' | 'tournament' | 'announcement'

// 決勝トーナメントブラケット表示コンポーネント
interface TournamentBracketDisplayProps {
  bracket: TournamentBracket
  user: any
  isDark: boolean
  onWinnerSelect: (matchId: string, winnerId: string) => Promise<void>
}

function TournamentBracketDisplay({ bracket, user, isDark, onWinnerSelect }: TournamentBracketDisplayProps) {
  const handlePlayerClick = async (match: Match, playerId: string) => {
    // 既に結果が登録されている場合は何もしない
    if (match.result) return
    
    // 自分のマッチでない場合は何もしない
    if (match.player1.userId !== user?.id && match.player2.userId !== user?.id) return
    
    // 確認ダイアログ
    const playerName = match.player1Id === playerId ? match.player1.user.name : match.player2.user.name
    if (!confirm(`${playerName}の勝利を登録しますか？`)) return
    
    await onWinnerSelect(match.id, playerId)
  }

  // 各ラウンドの最大マッチ数を計算（接続線の位置計算用）
  const maxMatchesPerRound = Math.max(...bracket.rounds.map(r => r.matches.length), 1)
  const matchHeight = 80 // 各マッチの高さ
  const matchGap = 20 // マッチ間の間隔
  const roundGap = 60 // ラウンド間の間隔
  const titleHeight = 40 // タイトル部分の高さ

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      gap: `${roundGap}px`,
      overflowX: 'auto',
      padding: '40px 20px',
      alignItems: 'flex-start',
      backgroundImage: 'radial-gradient(circle, #e0e0e0 1px, transparent 1px)',
      backgroundSize: '20px 20px',
      backgroundColor: isDark ? '#1a1a1a' : '#fff',
      minHeight: `${titleHeight + maxMatchesPerRound * (matchHeight + matchGap)}px`,
    }}>
      {bracket.rounds.map((roundData, roundIndex) => {
        const isLastRound = roundIndex === bracket.rounds.length - 1
        
        return (
          <div key={roundData.round} style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: `${matchGap}px`,
            minWidth: '200px',
          }}>
            <h3 style={{
              color: isDark ? '#fff' : '#333',
              marginBottom: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              textAlign: 'center',
            }}>
              第{roundData.round}回戦
            </h3>
            
            {/* 接続線（次のラウンドへの線） */}
            {!isLastRound && (() => {
              const nextRoundMatches = bracket.rounds[roundIndex + 1].matches
              const svgHeight = roundData.matches.length * (matchHeight + matchGap)
              
              return (
                <svg
                  style={{
                    position: 'absolute',
                    left: '100%',
                    top: `${titleHeight}px`,
                    width: `${roundGap}px`,
                    height: `${svgHeight}px`,
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                >
                {roundData.matches.map((match, matchIndex) => {
                  const currentY = matchIndex * (matchHeight + matchGap) + matchHeight / 2
                  
                  return (
                    <g key={match.id}>
                      {/* 水平線（現在のラウンドから） */}
                      <line
                        x1="0"
                        y1={currentY}
                        x2={roundGap / 2}
                        y2={currentY}
                        stroke={isDark ? '#666' : '#333'}
                        strokeWidth="2"
                      />
                    </g>
                  )
                })}
                  {/* 垂直線と次のラウンドへの水平線（ペアごとに描画） */}
                  {nextRoundMatches.map((_, nextMatchIndex) => {
                    const pairStartIndex = nextMatchIndex * 2
                    const pairEndIndex = pairStartIndex + 1
                    const hasPairEnd = pairEndIndex < roundData.matches.length
                    
                    if (!hasPairEnd) return null
                    
                    const startY = pairStartIndex * (matchHeight + matchGap) + matchHeight / 2
                    const endY = pairEndIndex * (matchHeight + matchGap) + matchHeight / 2
                    const nextY = nextMatchIndex * (matchHeight + matchGap) + matchHeight / 2
                    const centerY = (startY + endY) / 2
                    
                    return (
                      <g key={`connector-${nextMatchIndex}`}>
                        {/* 垂直線（2つのマッチを結合） */}
                        <line
                          x1={roundGap / 2}
                          y1={startY}
                          x2={roundGap / 2}
                          y2={endY}
                          stroke={isDark ? '#666' : '#333'}
                          strokeWidth="2"
                        />
                        {/* 水平線（次のラウンドへ） */}
                        <line
                          x1={roundGap / 2}
                          y1={nextY}
                          x2={roundGap}
                          y2={nextY}
                          stroke={isDark ? '#666' : '#333'}
                          strokeWidth="2"
                        />
                        {/* 中央の垂直線（結合点から次のラウンドへ） */}
                        <line
                          x1={roundGap / 2}
                          y1={centerY}
                          x2={roundGap / 2}
                          y2={nextY}
                          stroke={isDark ? '#666' : '#333'}
                          strokeWidth="2"
                        />
                      </g>
                    )
                  })}
                </svg>
              )
            })()}
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${matchGap}px`,
              position: 'relative',
              zIndex: 1,
            }}>
              {roundData.matches.map((match, matchIndex) => {
                const isPlayer1 = match.player1.userId === user?.id
                const isPlayer2 = match.player2.userId === user?.id
                const isMyMatch = isPlayer1 || isPlayer2
                const isBye = match.player1Id === match.player2Id
                const winnerId = match.result === 'player1' ? match.player1Id : match.result === 'player2' ? match.player2Id : null
                
                return (
                  <div
                    key={match.id}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      width: '180px',
                      minHeight: `${matchHeight}px`,
                      padding: '10px',
                      backgroundColor: isDark ? '#2a5a7a' : '#b3d9ff',
                      borderRadius: '6px',
                      border: isMyMatch ? `2px solid ${isDark ? '#4CAF50' : '#2196F3'}` : `2px solid ${isDark ? '#4a6a8a' : '#80c0ff'}`,
                      boxShadow: isMyMatch ? `0 0 8px ${isDark ? '#4CAF50' : '#2196F3'}` : 'none',
                    }}
                  >
                    {/* Player 1 */}
                    <div
                      onClick={() => isMyMatch && !match.result && handlePlayerClick(match, match.player1Id)}
                      style={{
                        padding: '8px',
                        marginBottom: '4px',
                        backgroundColor: winnerId === match.player1Id 
                          ? (isDark ? '#4CAF50' : '#90EE90')
                          : (isDark ? '#1a3a5a' : '#fff'),
                        borderRadius: '4px',
                        cursor: isMyMatch && !match.result ? 'pointer' : 'default',
                        border: winnerId === match.player1Id ? `2px solid ${isDark ? '#4CAF50' : '#2196F3'}` : `1px solid ${isDark ? '#4a6a8a' : '#80c0ff'}`,
                        fontWeight: winnerId === match.player1Id ? 'bold' : 'normal',
                        color: winnerId === match.player1Id 
                          ? (isDark ? '#fff' : '#000')
                          : (isDark ? '#fff' : '#333'),
                        transition: 'all 0.2s',
                        opacity: match.result && winnerId !== match.player1Id ? 0.5 : 1,
                        textAlign: 'center',
                        fontSize: '13px',
                      }}
                      onMouseEnter={(e) => {
                        if (isMyMatch && !match.result) {
                          e.currentTarget.style.backgroundColor = isDark ? '#3a4a6a' : '#e0f0ff'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isMyMatch && !match.result) {
                          e.currentTarget.style.backgroundColor = winnerId === match.player1Id 
                            ? (isDark ? '#4CAF50' : '#90EE90')
                            : (isDark ? '#1a3a5a' : '#fff')
                        }
                      }}
                    >
                      {match.player1.user.name}
                    </div>
                    
                    {/* VS or BYE */}
                    {!isBye && (
                      <div style={{
                        fontSize: '11px',
                        color: isDark ? '#aaa' : '#666',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        margin: '2px 0',
                      }}>
                        VS
                      </div>
                    )}
                    
                    {/* Player 2 */}
                    {!isBye ? (
                      <div
                        onClick={() => isMyMatch && !match.result && handlePlayerClick(match, match.player2Id)}
                        style={{
                          padding: '8px',
                          backgroundColor: winnerId === match.player2Id 
                            ? (isDark ? '#4CAF50' : '#90EE90')
                            : (isDark ? '#1a3a5a' : '#fff'),
                          borderRadius: '4px',
                          cursor: isMyMatch && !match.result ? 'pointer' : 'default',
                          border: winnerId === match.player2Id ? `2px solid ${isDark ? '#4CAF50' : '#2196F3'}` : `1px solid ${isDark ? '#4a6a8a' : '#80c0ff'}`,
                          fontWeight: winnerId === match.player2Id ? 'bold' : 'normal',
                          color: winnerId === match.player2Id 
                            ? (isDark ? '#fff' : '#000')
                            : (isDark ? '#fff' : '#333'),
                          transition: 'all 0.2s',
                          opacity: match.result && winnerId !== match.player2Id ? 0.5 : 1,
                          textAlign: 'center',
                          fontSize: '13px',
                        }}
                        onMouseEnter={(e) => {
                          if (isMyMatch && !match.result) {
                            e.currentTarget.style.backgroundColor = isDark ? '#3a4a6a' : '#e0f0ff'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isMyMatch && !match.result) {
                            e.currentTarget.style.backgroundColor = winnerId === match.player2Id 
                              ? (isDark ? '#4CAF50' : '#90EE90')
                              : (isDark ? '#1a3a5a' : '#fff')
                          }
                        }}
                      >
                        {match.player2.user.name}
                      </div>
                    ) : (
                      <div style={{
                        padding: '8px',
                        backgroundColor: isDark ? '#1a3a5a' : '#fff',
                        borderRadius: '4px',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: isDark ? '#aaa' : '#666',
                        fontStyle: 'italic',
                      }}>
                        BYE
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const isDark = useDarkMode()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [standings, setStandings] = useState<any[]>([])
  const [entryStatus, setEntryStatus] = useState<any>(null)
  const [announcement, setAnnouncement] = useState('')
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState('')
  const [loading, setLoading] = useState(true)
  // 勝敗登録ダイアログ
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('details')
  // トーナメント表示用のタブ
  const [tournamentViewTab, setTournamentViewTab] = useState<'matches' | 'ranking'>('matches')
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [isMobile, setIsMobile] = useState(false)
  const [lastNotifiedRound, setLastNotifiedRound] = useState<number>(0)
  const [isPreliminaryCompleted, setIsPreliminaryCompleted] = useState<boolean>(false)
  const [checkingPreliminaryCompleted, setCheckingPreliminaryCompleted] = useState<boolean>(false)
  const [tournamentBracket, setTournamentBracket] = useState<TournamentBracket | null>(null)
  const [loadingBracket, setLoadingBracket] = useState<boolean>(false)

  // モバイル判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  const [qrCode, setQrCode] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [entering, setEntering] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [editingData, setEditingData] = useState<{
    name: string
    description: string
    logoImageUrl: string
    entryFee: number | null
    venueName: string
    venueAddress: string
    eventDate: string
    registrationTime: string
    registrationEndTime: string
    startTime: string
    capacity: number | null
    entryStartAt: string
    entryEndAt: string
    isPublic: boolean
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [checkingInParticipants, setCheckingInParticipants] = useState<Set<string>>(new Set())
  const [cancellingParticipants, setCancellingParticipants] = useState<Set<string>>(new Set())
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestPlayerName, setGuestPlayerName] = useState('')
  const [addingGuest, setAddingGuest] = useState(false)
  const [showTournamentCreateForm, setShowTournamentCreateForm] = useState(false)
  const [preliminaryRoundsType, setPreliminaryRoundsType] = useState<'number' | 'until_one_undefeated' | 'until_two_undefeated'>('number')
  const [preliminaryRoundsNumber, setPreliminaryRoundsNumber] = useState<number>(3)
  const [creatingTournament, setCreatingTournament] = useState(false)

  useEffect(() => {
    if (id) {
      loadTournament()
      loadParticipants()
      loadEntryStatus()
      loadAnnouncement()
    }
    
    // 通知の許可をリクエスト
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [id])

  // 予選完了判定をチェック
  const checkPreliminaryStatus = useCallback(async () => {
    if (!id || checkingPreliminaryCompleted) return
    setCheckingPreliminaryCompleted(true)
    try {
      const result = await checkPreliminaryCompleted(id)
      console.log('予選完了判定結果:', result)
      setIsPreliminaryCompleted(result.isCompleted)
      console.log('isPreliminaryCompleted を設定:', result.isCompleted)
    } catch (error) {
      console.error('予選完了判定の確認に失敗しました', error)
    } finally {
      setCheckingPreliminaryCompleted(false)
    }
  }, [id, checkingPreliminaryCompleted])

  // トーナメント読み込み後、管理者/開催者の場合に予選完了判定をチェック
  useEffect(() => {
    if (!id || !tournament) return
    
    const isOrganizer = (user?.role === 'organizer' || user?.role === 'admin') && tournament.organizerId === user?.id
    const isAdmin = user?.role === 'admin'
    const canEdit = isOrganizer || isAdmin
    
    // 管理者/開催者で、大会が進行中の場合に予選完了判定をチェック
    if (canEdit && tournament.status === 'in_progress') {
      checkPreliminaryStatus()
    }
  }, [id, tournament, user, checkPreliminaryStatus])

  // タブ変更時にデータを読み込む
  useEffect(() => {
    if (!id || !tournament) return
    
    const isOrganizer = (user?.role === 'organizer' || user?.role === 'admin') && tournament.organizerId === user?.id
    const isAdmin = user?.role === 'admin'
    const canEdit = isOrganizer || isAdmin
    
    if (activeTab === 'tournament') {
      loadMatches() // すべてのラウンドのマッチを読み込む
      loadStandings()
      // 予選完了判定をチェック（管理者/開催者のみ）
      if (canEdit) {
        checkPreliminaryStatus()
      }
      // トーナメントタブでも決勝トーナメントデータを読み込む（ボタン表示用）
      const loadBracket = async () => {
        try {
          const bracket = await getTournamentBracket(id)
          setTournamentBracket(bracket)
        } catch (error) {
          console.error('Failed to load tournament bracket:', error)
          setTournamentBracket(null)
        }
      }
      loadBracket()
    }
  }, [id, activeTab, selectedRound])

  // 対戦表画面で定期的にデータを更新（5秒ごと）
  useEffect(() => {
    if (id && activeTab === 'tournament' && tournament?.status === 'in_progress') {
      const interval = setInterval(() => {
        loadMatches() // すべてのラウンドのマッチを読み込む
        loadStandings()
        // 管理者/開催者の場合、予選完了判定もチェック
        const isOrganizer = (user?.role === 'organizer' || user?.role === 'admin') && tournament?.organizerId === user?.id
        const isAdmin = user?.role === 'admin'
        const canEdit = isOrganizer || isAdmin
        if (canEdit) {
          checkPreliminaryStatus()
        }
      }, 5000) // 5秒ごとに更新

      return () => clearInterval(interval)
    }
  }, [id, activeTab, selectedRound, tournament?.status, tournament?.organizerId, user, checkPreliminaryStatus])

  // 新しい回戦が開始されたら通知を送る（10秒ごとにチェック）
  useEffect(() => {
    if (!id || tournament?.status !== 'in_progress') return

    const checkNewRound = async () => {
      try {
        const data = await getTournament(id)
        const currentRound = data.currentRound || 0
        
        // 新しい回戦が開始された場合
        if (currentRound > lastNotifiedRound && lastNotifiedRound > 0) {
          // 通知を送る
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(`第${currentRound}回戦が開始されました`, {
              body: `${tournament.name}の第${currentRound}回戦の対戦表が発表されました。`,
              icon: '/favicon.ico',
              tag: `tournament-${id}-round-${currentRound}`,
            })
            
            notification.onclick = () => {
              window.focus()
              setActiveTab('tournament')
              setSelectedRound(currentRound)
              notification.close()
            }
          }
          
          setLastNotifiedRound(currentRound)
          setTournament(data)
          if (currentRound > 0) {
            setSelectedRound(currentRound)
          }
        } else if (currentRound > lastNotifiedRound) {
          // 初回は通知しない（lastNotifiedRoundが0の場合）
          setLastNotifiedRound(currentRound)
        }
      } catch (error) {
        console.error('新しい回戦の確認に失敗しました', error)
      }
    }

    const interval = setInterval(checkNewRound, 10000) // 10秒ごとにチェック

    return () => clearInterval(interval)
  }, [id, tournament?.status, tournament?.name, lastNotifiedRound])

  // モバイル判定
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // カウントダウンタイマー
  useEffect(() => {
    if (!entryStatus || !entryStatus.tournament.entryStartAt || !entryStatus.tournament.entryEndAt) {
      return
    }

    const updateTimer = () => {
      const now = getJSTNow()
      const entryStart = parseJSTISOString(entryStatus.tournament.entryStartAt)
      const entryEnd = parseJSTISOString(entryStatus.tournament.entryEndAt)

      if (now < entryStart) {
        setTimeRemaining(getTimeRemaining(entryStart))
      } else if (now >= entryStart && now <= entryEnd) {
        setTimeRemaining(getTimeRemaining(entryEnd))
      } else {
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
      // 現在のラウンドが存在する場合、selectedRoundを更新
      if (data.currentRound && data.currentRound > 0) {
        setSelectedRound(data.currentRound)
      }
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
    } catch (error: any) {
      console.error('参加者一覧の取得に失敗しました', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      // エラーをユーザーに表示
      if (error.response?.data?.error) {
        console.error('Error from server:', error.response.data.error)
      }
    }
  }

  const loadMatches = async (round?: number) => {
    if (!id) return
    try {
      const data = await getMatches(id, round)
      if (round) {
        // 特定のラウンドを読み込む場合、既存のマッチとマージする
        setMatches((prevMatches: Match[]) => {
          // そのラウンドの既存のマッチを削除
          const filtered = prevMatches.filter((m: Match) => m.round !== round)
          // 新しいマッチを追加
          return [...filtered, ...data]
        })
      } else {
        // すべてのラウンドを読み込む場合、そのまま設定
        setMatches(data)
      }
    } catch (error) {
      console.error('対戦一覧の取得に失敗しました', error)
    }
  }

  const loadStandings = async () => {
    if (!id) return
    try {
      const data = await getStandings(id)
      setStandings(data)
    } catch (error) {
      console.error('順位表の取得に失敗しました', error)
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

  const loadAnnouncement = async () => {
    if (!id) return
    try {
      const data = await getAnnouncement(id)
      setAnnouncement(data.announcement)
    } catch (error) {
      console.error('アナウンスの取得に失敗しました', error)
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

  const handleSaveAnnouncement = async () => {
    if (!id) return
    try {
      await updateAnnouncement(id, editingAnnouncement)
      setAnnouncement(editingAnnouncement)
      setIsEditingAnnouncement(false)
      alert('アナウンスを更新しました')
    } catch (error: any) {
      alert(error.response?.data?.message || 'アナウンスの更新に失敗しました')
    }
  }

  const handleStartEdit = () => {
    if (!tournament) return
    setEditingData({
      name: tournament.name,
      description: tournament.description || '',
      logoImageUrl: (tournament as any).logoImageUrl || '',
      entryFee: (tournament as any).entryFee ?? null,
      venueName: (tournament as any).venueName || '',
      venueAddress: (tournament as any).venueAddress || '',
      eventDate: tournament.eventDate || '',
      registrationTime: tournament.registrationTime || '',
      registrationEndTime: tournament.registrationEndTime || '',
      startTime: tournament.startTime || '',
      capacity: tournament.capacity ?? null,
      entryStartAt: tournament.entryStartAt || '',
      entryEndAt: tournament.entryEndAt || '',
      isPublic: (tournament as any).isPublic !== undefined ? (tournament as any).isPublic : true,
    })
    setIsEditing(true)
  }

  // 開催日を設定したら、時間の日付部分を自動設定
  const handleEventDateChange = (dateValue: string) => {
    if (!editingData) return
    
    let newRegistrationTime = editingData.registrationTime
    let newRegistrationEndTime = editingData.registrationEndTime
    let newStartTime = editingData.startTime
    
    if (dateValue) {
      // 既存の時間がある場合、日付部分だけを更新
      if (editingData.registrationTime) {
        const timePart = getTimePart(editingData.registrationTime)
        newRegistrationTime = combineDateAndTime(dateValue, timePart)
      } else {
        // 時間がない場合、デフォルトで9:00に設定
        newRegistrationTime = combineDateAndTime(dateValue, '09:00')
      }
      
      if (editingData.registrationEndTime) {
        const timePart = getTimePart(editingData.registrationEndTime)
        newRegistrationEndTime = combineDateAndTime(dateValue, timePart)
      } else {
        // 時間がない場合、デフォルトで10:00に設定
        newRegistrationEndTime = combineDateAndTime(dateValue, '10:00')
      }
      
      if (editingData.startTime) {
        const timePart = getTimePart(editingData.startTime)
        newStartTime = combineDateAndTime(dateValue, timePart)
      } else {
        // 時間がない場合、デフォルトで11:00に設定
        newStartTime = combineDateAndTime(dateValue, '11:00')
      }
    }
    
    setEditingData({
      ...editingData,
      eventDate: dateValue ? `${dateValue}T00:00:00+09:00` : '',
      registrationTime: newRegistrationTime,
      registrationEndTime: newRegistrationEndTime,
      startTime: newStartTime,
    })
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditingData(null)
  }

  const handleSaveTournament = async () => {
    if (!id || !editingData) return
    setSaving(true)
    try {
      const updated = await updateTournament(id, {
        name: editingData.name,
        description: editingData.description || undefined,
        logoImageUrl: editingData.logoImageUrl || undefined,
        entryFee: editingData.entryFee ?? undefined,
        venueName: editingData.venueName || undefined,
        venueAddress: editingData.venueAddress || undefined,
        eventDate: editingData.eventDate || undefined,
        registrationTime: editingData.registrationTime || undefined,
        registrationEndTime: editingData.registrationEndTime || undefined,
        startTime: editingData.startTime || undefined,
        capacity: editingData.capacity ?? undefined,
        entryStartAt: editingData.entryStartAt || undefined,
        entryEndAt: editingData.entryEndAt || undefined,
        isPublic: editingData.isPublic,
      })
      setTournament(updated)
      setIsEditing(false)
      setEditingData(null)
      alert('大会情報を更新しました')
    } catch (error: any) {
      alert(error.response?.data?.message || '大会情報の更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return null
    const date = parseJSTISOString(dateString)
    // parseJSTISOStringは既にローカル時刻として扱っているので、そのまま使用
    return format(date, 'HH:mm')
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    const date = parseJSTISOString(dateString)
    // parseJSTISOStringは既にローカル時刻として扱っているので、そのまま使用
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} (${weekdays[date.getDay()]})`
  }

  if (loading) {
    return <div>読み込み中...</div>
  }

  if (!tournament) {
    return <div>大会が見つかりません</div>
  }

  const isOrganizer = (user?.role === 'organizer' || user?.role === 'admin') && tournament.organizerId === user?.id
  const isAdmin = user?.role === 'admin'
  const canEditAnnouncement = isOrganizer || isAdmin
  const canEditTournament = isOrganizer || isAdmin

  // 受付時間中かチェック
  const isRegistrationPeriod = () => {
    if (!tournament.registrationTime || !tournament.registrationEndTime) return false
    const now = getJSTNow()
    const regStart = tournament.registrationTime ? parseJSTISOString(tournament.registrationTime) : null
    const regEnd = tournament.registrationEndTime ? parseJSTISOString(tournament.registrationEndTime) : null
    if (!regStart || !regEnd) return false
    return now >= regStart && now <= regEnd
  }

  // 受付終了時間以降かチェック
  const isAfterRegistrationEnd = () => {
    if (!tournament.registrationEndTime || tournament.registrationEndTime.trim() === '') {
      return false
    }
    const now = getJSTNow()
    const regEnd = parseJSTISOString(tournament.registrationEndTime)
    const isAfter = now >= regEnd
    // デバッグ用（本番では削除可能）
    console.log('isAfterRegistrationEnd check:', {
      now: now.toISOString(),
      nowLocal: now.toString(),
      regEnd: regEnd.toISOString(),
      regEndLocal: regEnd.toString(),
      registrationEndTime: tournament.registrationEndTime,
      isAfter,
      tournamentStatus: tournament.status,
      canEditTournament,
    })
    return isAfter
  }

  // チェックイン済みの参加者数を取得
  const getCheckedInCount = () => {
    return participants.filter((p) => p.checkedIn && !p.cancelledAt).length
  }

  // マッチング作成
  const handleCreateTournament = async () => {
    if (!id) return
    if (getCheckedInCount() < 2) {
      alert('チェックイン済みの参加者が2名未満です')
      return
    }

    let preliminaryRounds: number | 'until_one_undefeated' | 'until_two_undefeated'
    if (preliminaryRoundsType === 'number') {
      if (preliminaryRoundsNumber < 1) {
        alert('対戦表回戦数は1以上である必要があります')
        return
      }
      preliminaryRounds = preliminaryRoundsNumber
    } else {
      preliminaryRounds = preliminaryRoundsType
    }

    if (!confirm('マッチングを作成しますか？')) return

    setCreatingTournament(true)
    try {
      await startTournament(id, preliminaryRounds)
      alert('マッチングを作成しました')
      await loadTournament()
      await loadMatches()
      setShowTournamentCreateForm(false)
    } catch (error: any) {
      alert(error.response?.data?.message || 'トーナメントの作成に失敗しました')
    } finally {
      setCreatingTournament(false)
    }
  }

  const handleToggleCheckIn = async (participantId: string) => {
    if (!id) return
    setCheckingInParticipants((prev) => new Set(prev).add(participantId))
    try {
      const updated = await toggleParticipantCheckIn(id, participantId)
      // 参加者リストを更新
      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? updated : p))
      )
    } catch (error: any) {
      alert(error.response?.data?.message || 'チェックイン処理に失敗しました')
    } finally {
      setCheckingInParticipants((prev) => {
        const next = new Set(prev)
        next.delete(participantId)
        return next
      })
    }
  }

  const handleForceCancelParticipant = async (participantId: string) => {
    if (!id) return
    if (!confirm('この参加者を強制的にキャンセルしますか？')) return
    setCancellingParticipants((prev) => new Set(prev).add(participantId))
    try {
      await forceCancelParticipant(id, participantId)
      // 参加者リスト全体を再読み込み（繰り上がった参加者のisWaitlistも更新される）
      await loadParticipants()
      // エントリー状況を再読み込み
      loadEntryStatus()
      alert('参加者をキャンセルしました')
    } catch (error: any) {
      alert(error.response?.data?.message || '参加者のキャンセルに失敗しました')
    } finally {
      setCancellingParticipants((prev) => {
        const next = new Set(prev)
        next.delete(participantId)
        return next
      })
    }
  }

  const handleAddGuest = async () => {
    if (!id || !guestPlayerName.trim()) return
    setAddingGuest(true)
    try {
      const newParticipant = await addGuestParticipant(id, guestPlayerName.trim())
      setParticipants((prev) => [...prev, newParticipant])
      setGuestPlayerName('')
      setShowGuestForm(false)
      alert('ゲストユーザーを追加しました')
    } catch (error: any) {
      alert(error.response?.data?.message || 'ゲストユーザーの追加に失敗しました')
    } finally {
      setAddingGuest(false)
    }
  }

  // エントリーボタンの状態を取得
  const getEntryButtonState = () => {
    if (!entryStatus || !entryStatus.tournament.entryStartAt || !entryStatus.tournament.entryEndAt) {
      return null
    }

    const now = getJSTNow()
    const entryStart = parseJSTISOString(entryStatus.tournament.entryStartAt)
    const entryEnd = parseJSTISOString(entryStatus.tournament.entryEndAt)
    const isBeforeEntry = now < entryStart
    const isEntryPeriod = now >= entryStart && now <= entryEnd
    const isAfterEntry = now > entryEnd
    const hasEntry = entryStatus.myEntry && !entryStatus.myEntry.cancelledAt

    return { isBeforeEntry, isEntryPeriod, isAfterEntry, hasEntry }
  }

  const entryButtonState = getEntryButtonState()

  // エントリーボタンのレンダリング
  const renderEntryButton = () => {
    if (!entryButtonState) return null

    const { isBeforeEntry, isEntryPeriod, isAfterEntry, hasEntry } = entryButtonState

    if (isBeforeEntry) {
      return (
        <button
          disabled
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'not-allowed',
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            opacity: 0.8,
            width: '100%',
            maxWidth: '400px',
          }}
        >
          エントリー開始前です（開始まであと{timeRemaining}）
        </button>
      )
    } else if (isEntryPeriod) {
      if (hasEntry) {
        return (
          <button
            onClick={handleCancelEntry}
            disabled={cancelling}
            style={{
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: cancelling ? 'not-allowed' : 'pointer',
              width: '100%',
              maxWidth: '400px',
            }}
          >
            {cancelling ? 'キャンセル中...' : `エントリーをキャンセル（終了まであと${timeRemaining}）`}
          </button>
        )
      } else {
        return (
          <button
            onClick={handleEntry}
            disabled={entering}
            style={{
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: entering ? 'not-allowed' : 'pointer',
              width: '100%',
              maxWidth: '400px',
            }}
          >
            {entering ? 'エントリー中...' : `エントリーする（終了まであと${timeRemaining}）`}
          </button>
        )
      }
    } else if (isAfterEntry) {
      return (
        <button
          disabled
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'not-allowed',
            backgroundColor: '#9e9e9e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            opacity: 0.8,
            width: '100%',
            maxWidth: '400px',
          }}
        >
          エントリーは締め切りました
        </button>
      )
    }
    return null
  }

  return (
    <div
      style={{
        paddingBottom: '100px',
        backgroundColor: isDark ? '#121212' : '#fff',
        minHeight: '100vh',
        color: isDark ? '#fff' : '#333',
      }}
    >
      <BackButton to="/tournaments" />

      {/* ナビゲーションタブ */}
      <div
        style={{
          display: 'flex',
          borderBottom: `2px solid ${isDark ? '#333' : '#e0e0e0'}`,
          marginBottom: '20px',
          gap: '0',
        }}
      >
        {[
          { id: 'details' as TabType, label: 'イベント詳細' },
          { id: 'participants' as TabType, label: '参加者' },
          { id: 'tournament' as TabType, label: 'トーナメント' },
          { id: 'announcement' as TabType, label: 'アナウンス' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #2196F3' : '3px solid transparent',
              color: activeTab === tab.id ? '#2196F3' : isDark ? '#aaa' : '#666',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* イベント詳細タブ */}
      {activeTab === 'details' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* 編集ボタン（管理者または主催者のみ） */}
          {canEditTournament && !isEditing && (
            <div style={{ marginBottom: '20px', textAlign: 'right' }}>
              <button
                onClick={handleStartEdit}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                }}
              >
                編集
              </button>
            </div>
          )}

          {isEditing && editingData ? (
            /* 編集フォーム */
            <div
              style={{
                backgroundColor: isDark ? '#1a1a1a' : '#fff',
                padding: '30px',
                borderRadius: '12px',
                marginBottom: '30px',
                border: isDark ? '1px solid #333' : '1px solid #ddd',
              }}
            >
              <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 'bold', color: isDark ? '#fff' : '#333' }}>
                大会情報を編集
              </h2>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  大会名 *
                </label>
                <input
                  type="text"
                  value={editingData.name}
                  onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  大会説明
                </label>
                <textarea
                  value={editingData.description}
                  onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  ロゴ画像URL
                </label>
                <input
                  type="text"
                  value={editingData.logoImageUrl}
                  onChange={(e) => setEditingData({ ...editingData, logoImageUrl: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  会場名
                </label>
                <input
                  type="text"
                  value={editingData.venueName}
                  onChange={(e) => setEditingData({ ...editingData, venueName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  会場住所
                </label>
                <input
                  type="text"
                  value={editingData.venueAddress}
                  onChange={(e) => setEditingData({ ...editingData, venueAddress: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  開催日
                </label>
                <input
                  type="date"
                  value={editingData.eventDate ? getDatePart(editingData.eventDate) : ''}
                  onChange={(e) => handleEventDateChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  受付開始時間
                </label>
                <input
                  type="datetime-local"
                  value={editingData.registrationTime ? (() => {
                    const date = parseJSTISOString(editingData.registrationTime)
                    // parseJSTISOStringは既にローカル時刻として扱っているので、そのまま使用
                    return `${getDatePart(editingData.registrationTime)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                  })() : ''}
                  onChange={(e) => setEditingData({ ...editingData, registrationTime: e.target.value ? combineDateAndTime(e.target.value.split('T')[0], e.target.value.split('T')[1]) : '' })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  受付終了時間
                </label>
                <input
                  type="datetime-local"
                  value={editingData.registrationEndTime ? (() => {
                    const date = parseJSTISOString(editingData.registrationEndTime)
                    // parseJSTISOStringは既にローカル時刻として扱っているので、そのまま使用
                    return `${getDatePart(editingData.registrationEndTime)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                  })() : ''}
                  onChange={(e) => setEditingData({ ...editingData, registrationEndTime: e.target.value ? combineDateAndTime(e.target.value.split('T')[0], e.target.value.split('T')[1]) : '' })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  開始時間
                </label>
                <input
                  type="datetime-local"
                  value={editingData.startTime ? (() => {
                    const date = parseJSTISOString(editingData.startTime)
                    // parseJSTISOStringは既にローカル時刻として扱っているので、そのまま使用
                    return `${getDatePart(editingData.startTime)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                  })() : ''}
                  onChange={(e) => setEditingData({ ...editingData, startTime: e.target.value ? combineDateAndTime(e.target.value.split('T')[0], e.target.value.split('T')[1]) : '' })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  参加費（円）
                </label>
                <input
                  type="number"
                  value={editingData.entryFee ?? ''}
                  onChange={(e) => setEditingData({ ...editingData, entryFee: e.target.value ? parseInt(e.target.value) : null })}
                  min="0"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                  定員
                </label>
                <input
                  type="number"
                  value={editingData.capacity ?? ''}
                  onChange={(e) => setEditingData({ ...editingData, capacity: e.target.value ? parseInt(e.target.value) : null })}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #444' : '1px solid #ddd',
                    backgroundColor: isDark ? '#2a2a2a' : '#fff',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: isDark ? '#fff' : '#333', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingData.isPublic}
                    onChange={(e) => setEditingData({ ...editingData, isPublic: e.target.checked })}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontWeight: 'bold' }}>大会一覧に表示する</span>
                </label>
                <p style={{ marginTop: '5px', fontSize: '14px', color: isDark ? '#aaa' : '#666' }}>
                  チェックを外すと、一般ユーザーの大会一覧に表示されません（管理者と主催者は常に見れます）
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: isDark ? '#444' : '#f5f5f5',
                    color: isDark ? '#fff' : '#333',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveTournament}
                  disabled={saving || !editingData.name}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: saving || !editingData.name ? '#ccc' : '#2196F3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving || !editingData.name ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ロゴ画像 */}
              {(tournament as any).logoImageUrl && (
                <div
                  style={{
                    width: '100%',
                    height: '300px',
                    backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                    backgroundImage: `url(${(tournament as any).logoImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: '12px',
                    marginBottom: '30px',
                  }}
                />
              )}

              {/* 大会名 */}
              <h1 style={{ marginBottom: '10px', fontSize: '28px', fontWeight: 'bold', color: isDark ? '#fff' : '#333' }}>
                {tournament.name}
              </h1>
            </>
          )}


              {/* 大会情報 */}
              {!isEditing && (
                <div
                  style={{
                    backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9',
                    padding: '20px',
                    borderRadius: '12px',
                    marginBottom: '30px',
                    border: isDark ? '1px solid #333' : 'none',
                  }}
                >
            {/* 会場名 */}
            {(tournament as any).venueName && (
              <div
                style={{
                  marginBottom: '15px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isDark ? '#fff' : '#333',
                }}
              >
                <span>📍</span>
                <span>{(tournament as any).venueName}</span>
              </div>
            )}

            {/* 住所 */}
            {(tournament as any).venueAddress && (
              <div
                style={{
                  marginBottom: '15px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  color: isDark ? '#fff' : '#333',
                }}
              >
                <span>📍</span>
                <span>{(tournament as any).venueAddress}</span>
              </div>
            )}

            {/* 開催日 */}
            {tournament.eventDate && (
              <div
                style={{
                  marginBottom: '15px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isDark ? '#fff' : '#333',
                }}
              >
                <span>📅</span>
                <span>{formatDate(tournament.eventDate)}</span>
              </div>
            )}

            {/* 受付時間 */}
            {tournament.registrationTime && tournament.registrationEndTime && (
              <div
                style={{
                  marginBottom: '15px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isDark ? '#fff' : '#333',
                }}
              >
                <span>⏰</span>
                <span>
                  {formatTime(tournament.registrationTime)} ～ {formatTime(tournament.registrationEndTime)}
                </span>
              </div>
            )}

            {/* 開始時間 */}
            {tournament.startTime && (
              <div
                style={{
                  marginBottom: '15px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isDark ? '#fff' : '#333',
                }}
              >
                <span>🚀</span>
                <span>{formatTime(tournament.startTime)}</span>
              </div>
            )}

            {/* 参加費 */}
            {(tournament as any).entryFee !== undefined && (tournament as any).entryFee !== null && (
              <div
                style={{
                  marginBottom: '15px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isDark ? '#fff' : '#333',
                }}
              >
                <span>💰</span>
                <span>{(tournament as any).entryFee === 0 ? '無料' : `¥${((tournament as any).entryFee).toLocaleString()}`}</span>
              </div>
            )}

            {/* エントリー状況 */}
            {entryStatus && (
              <div
                style={{
                  marginBottom: '15px',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isDark ? '#fff' : '#333',
                }}
              >
                <span>👥</span>
                <span>
                  {(entryStatus.confirmedCount || 0) + (entryStatus.waitlistCount || 0)}/{entryStatus.tournament.capacity || '無制限'}人
                  {entryStatus.waitlistCount > 0 && (
                    <span style={{ color: isDark ? '#ff9800' : '#ff6b00', marginLeft: '8px' }}>
                      (キャンセル待ち: {entryStatus.waitlistCount}人)
                    </span>
                  )}
                </span>
              </div>
            )}
                </div>
              )}

          {/* マッチング作成（管理者または主催者のみ、受付終了時間以降） */}
          {/* デバッグ用: 条件の状態を確認 */}
          {import.meta.env.DEV && canEditTournament && tournament.status === 'registration' && (
            <div style={{ padding: '10px', backgroundColor: '#f0f0f0', marginBottom: '10px', fontSize: '12px' }}>
              <div>canEditTournament: {canEditTournament ? 'true' : 'false'}</div>
              <div>tournament.status: {tournament.status}</div>
              <div>isAfterRegistrationEnd: {isAfterRegistrationEnd() ? 'true' : 'false'}</div>
              <div>registrationEndTime: {tournament.registrationEndTime || '(未設定)'}</div>
              <div>現在時刻: {getJSTNow().toISOString()}</div>
            </div>
          )}
          {canEditTournament && (tournament.status === 'registration' || tournament.status === 'draft' || (tournament.status as string) === 'preparing') && isAfterRegistrationEnd() && (
            <div
              style={{
                marginBottom: '30px',
                padding: '15px',
                border: `1px solid ${isDark ? '#333' : '#ccc'}`,
                borderRadius: '8px',
                backgroundColor: isDark ? '#1a1a1a' : '#fff',
              }}
            >
              <h3 style={{ color: isDark ? '#fff' : '#333', marginBottom: '15px' }}>マッチング作成</h3>
              {!showTournamentCreateForm ? (
                <div>
                  <p style={{ color: isDark ? '#aaa' : '#666', marginBottom: '15px' }}>
                    チェックイン済み: {getCheckedInCount()}名
                    {getCheckedInCount() < 2 && (
                      <span style={{ color: '#f44336', marginLeft: '10px' }}>
                        (2名以上必要)
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => setShowTournamentCreateForm(true)}
                    disabled={getCheckedInCount() < 2}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: getCheckedInCount() < 2 ? '#ccc' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: getCheckedInCount() < 2 ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}
                  >
                    マッチングを作成
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                      対戦表終了条件
                    </label>
                    <select
                      value={preliminaryRoundsType}
                      onChange={(e) => setPreliminaryRoundsType(e.target.value as 'number' | 'until_one_undefeated' | 'until_two_undefeated')}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '6px',
                        border: isDark ? '1px solid #444' : '1px solid #ddd',
                        backgroundColor: isDark ? '#2a2a2a' : '#fff',
                        color: isDark ? '#fff' : '#333',
                        fontSize: '14px',
                      }}
                    >
                      <option value="number">指定回戦数</option>
                      <option value="until_one_undefeated">無敗が1人になるまで</option>
                      <option value="until_two_undefeated">無敗が2人になるまで</option>
                    </select>
                  </div>
                  {preliminaryRoundsType === 'number' && (
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', color: isDark ? '#fff' : '#333', fontWeight: 'bold' }}>
                        対戦表回戦数
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={preliminaryRoundsNumber}
                        onChange={(e) => setPreliminaryRoundsNumber(parseInt(e.target.value) || 1)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '6px',
                          border: isDark ? '1px solid #444' : '1px solid #ddd',
                          backgroundColor: isDark ? '#2a2a2a' : '#fff',
                          color: isDark ? '#fff' : '#333',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={handleCreateTournament}
                      disabled={creatingTournament || getCheckedInCount() < 2}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: creatingTournament || getCheckedInCount() < 2 ? '#ccc' : '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: creatingTournament || getCheckedInCount() < 2 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      {creatingTournament ? '作成中...' : '作成'}
                    </button>
                    <button
                      onClick={() => setShowTournamentCreateForm(false)}
                      disabled={creatingTournament}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: isDark ? '#444' : '#f5f5f5',
                        color: isDark ? '#fff' : '#333',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: creatingTournament ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* チェックイン（参加者のみ） */}
          {tournament.status === 'registration' && participants.some((p) => p.userId === user?.id && !p.cancelledAt) && (
            <div
              style={{
                marginBottom: '30px',
                padding: '15px',
                border: `1px solid ${isDark ? '#333' : '#ccc'}`,
                borderRadius: '8px',
                backgroundColor: isDark ? '#1a1a1a' : '#fff',
              }}
            >
              <h3 style={{ color: isDark ? '#fff' : '#333', marginBottom: '10px' }}>チェックイン</h3>
              <p style={{ color: isDark ? '#aaa' : '#666', marginBottom: '10px' }}>
                大会で発行されたQRコードを入力してください
              </p>
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="QRコード"
                style={{
                  padding: '8px',
                  marginRight: '10px',
                  width: '300px',
                  backgroundColor: isDark ? '#2a2a2a' : '#fff',
                  color: isDark ? '#fff' : '#333',
                  border: `1px solid ${isDark ? '#333' : '#ccc'}`,
                  borderRadius: '4px',
                }}
              />
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: checkingIn ? 'not-allowed' : 'pointer',
                }}
              >
                {checkingIn ? 'チェックイン中...' : 'チェックイン'}
              </button>
            </div>
          )}

        </div>
      )}

      {/* 参加者タブ */}
      {activeTab === 'participants' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2
              style={{
                color: isDark ? '#fff' : '#333',
                margin: 0,
              }}
            >
              参加者一覧 ({participants.length}
              {entryStatus?.tournament.capacity ? `/${entryStatus.tournament.capacity}` : ''}名)
            </h2>
            {/* ゲストユーザー追加ボタン（管理者または主催者のみ、受付時間外でも可能） */}
            {canEditTournament && (
              <div>
                {!showGuestForm ? (
                  <button
                    onClick={() => setShowGuestForm(true)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }}
                  >
                    + ゲスト追加
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={guestPlayerName}
                      onChange={(e) => setGuestPlayerName(e.target.value)}
                      placeholder="プレイヤー名"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: isDark ? '1px solid #333' : '1px solid #ddd',
                        backgroundColor: isDark ? '#2a2a2a' : '#fff',
                        color: isDark ? '#fff' : '#333',
                        fontSize: '14px',
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && guestPlayerName.trim()) {
                          handleAddGuest()
                        }
                      }}
                    />
                    <button
                      onClick={handleAddGuest}
                      disabled={addingGuest || !guestPlayerName.trim()}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: addingGuest || !guestPlayerName.trim() ? '#ccc' : '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: addingGuest || !guestPlayerName.trim() ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                      }}
                    >
                      {addingGuest ? '追加中...' : '追加'}
                    </button>
                    <button
                      onClick={() => {
                        setShowGuestForm(false)
                        setGuestPlayerName('')
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: isDark ? '#444' : '#f5f5f5',
                        color: isDark ? '#fff' : '#333',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#fff',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {participants
              .filter((p) => !p.cancelledAt)
              .sort((a, b) => {
                // enteredAtでソート（エントリー順）- ミリ秒まで正確に比較
                const dateA = a.enteredAt ? parseJSTISOString(a.enteredAt).getTime() : 0
                const dateB = b.enteredAt ? parseJSTISOString(b.enteredAt).getTime() : 0
                
                // ミリ秒まで比較（絶対に時間が早い方が上に来る）
                if (dateA < dateB) {
                  return -1
                }
                if (dateA > dateB) {
                  return 1
                }
                
                // 同じミリ秒の場合（本番運用で同じ時刻にエントリーされた場合）は、createdAtでソート
                // より早くデータベースに保存された方が先（先着順）
                const createdA = (a as any).createdAt ? parseJSTISOString((a as any).createdAt).getTime() : 0
                const createdB = (b as any).createdAt ? parseJSTISOString((b as any).createdAt).getTime() : 0
                if (createdA !== createdB) {
                  return createdA - createdB
                }
                
                // 同じcreatedAtの場合（理論的にはありえないが念のため）はIDでソート
                return a.id.localeCompare(b.id)
              })
              .map((participant, index) => {
                // エントリーNo.は、enteredAt順でソートされた後の順番（1から始まる）
                const entryNumber = index + 1
                return (
                  <div
                    key={participant.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: canEditTournament ? (isRegistrationPeriod() ? '40px 80px 1fr 200px 150px 120px 100px' : '40px 80px 1fr 200px 150px 100px') : '40px 80px 1fr 200px 150px',
                      gap: '16px',
                      padding: '16px',
                      borderBottom:
                        index <
                        participants.filter((p) => !p.cancelledAt).length - 1
                          ? '1px solid'
                          : 'none',
                      borderColor: isDark ? '#333' : '#e0e0e0',
                      backgroundColor: isDark ? '#1a1a1a' : '#fff',
                      color: isDark ? '#fff' : '#333',
                    }}
                  >
                    {/* チェックイン状態（先頭にチェックマーク） */}
                    <div style={{ color: isDark ? '#aaa' : '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {participant.checkedIn && (
                        <span style={{ color: isDark ? '#4caf50' : '#2e7d32', fontSize: '18px' }}>✓</span>
                      )}
                    </div>
                    <div style={{ color: isDark ? '#aaa' : '#666' }}>{entryNumber}</div>
                  <div>
                    {participant.user.name}
                    {participant.isWaitlist && (
                      <span style={{ color: isDark ? '#ff9800' : '#ff6b00', marginLeft: '8px' }}>
                        (キャンセル待ち)
                      </span>
                    )}
                  </div>
                  <div style={{ color: isDark ? '#aaa' : '#666', fontSize: '14px' }}>
                    {participant.enteredAt ? (() => {
                      // データベースから返されるISO文字列（UTC）をローカル時刻（JST）に変換
                      const date = new Date(participant.enteredAt)
                      // デバッグ用
                      if (import.meta.env.DEV) {
                        console.log('enteredAt display:', {
                          original: participant.enteredAt,
                          parsed: date.toISOString(),
                          local: date.toString(),
                          formatted: format(date, 'yyyy年MM月dd日 HH:mm')
                        })
                      }
                      return format(date, 'yyyy年MM月dd日 HH:mm')
                    })() : '-'}
                  </div>
                  <div style={{ color: isDark ? '#aaa' : '#666', fontSize: '14px' }}>
                    {participant.dropped && <span style={{ color: isDark ? '#f44336' : '#c62828' }}>(棄権)</span>}
                    {!participant.dropped && !participant.checkedIn && '-'}
                  </div>
                  {/* チェックインボタン（管理者または主催者のみ、受付時間中のみ） */}
                  {canEditTournament && isRegistrationPeriod() && (
                    <div>
                      <button
                        onClick={() => handleToggleCheckIn(participant.id)}
                        disabled={checkingInParticipants.has(participant.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: participant.checkedIn ? (isDark ? '#444' : '#f5f5f5') : '#2196F3',
                          color: participant.checkedIn ? (isDark ? '#fff' : '#333') : 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: checkingInParticipants.has(participant.id) ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        {checkingInParticipants.has(participant.id)
                          ? '処理中...'
                          : participant.checkedIn
                          ? 'チェックアウト'
                          : 'チェックイン'}
                      </button>
                    </div>
                  )}
                  {/* 強制キャンセルボタン（管理者または主催者のみ） */}
                  {canEditTournament && !participant.cancelledAt && (
                    <div>
                      <button
                        onClick={() => handleForceCancelParticipant(participant.id)}
                        disabled={cancellingParticipants.has(participant.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: cancellingParticipants.has(participant.id) ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          marginLeft: '8px',
                        }}
                      >
                        {cancellingParticipants.has(participant.id) ? '処理中...' : 'キャンセル'}
                      </button>
                    </div>
                  )}
                </div>
                )
              })}
          </div>
        </div>
      )}

      {/* トーナメントタブ */}
      {activeTab === 'tournament' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* 管理画面へのリンク（管理者または主催者のみ） */}
          {canEditTournament && (
            <div style={{ marginBottom: '20px', textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Link to={`/tournaments/${id}/admin`}>
                <button
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  管理画面
                </button>
              </Link>
              
              {/* トーナメントリセットボタン（デバッグ用） */}
              {tournament.status === 'in_progress' && (
                <button
                  onClick={async () => {
                    if (!id) return
                    if (!confirm('トーナメントを1回戦開始前にリセットしますか？\nすべてのマッチと成績が削除されます。')) return
                    try {
                      await resetTournament(id)
                      alert('トーナメントをリセットしました')
                      await loadTournament()
                      await loadMatches() // すべてのラウンドのマッチを読み込む
                    } catch (error: any) {
                      console.error('Reset tournament error:', error)
                      const errorMessage = error.response?.data?.message || error.message || 'トーナメントのリセットに失敗しました'
                      alert(errorMessage)
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  リセット（1回戦開始前に戻す）
                </button>
              )}
            </div>
          )}
          {tournament.status === 'in_progress' ? (
            <div style={{ width: '100%' }}>
              {/* 管理ボタン */}
              {canEditTournament && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '20px' }}>
                  {matches.length > 0 && selectedRound === 1 && (
                    <button
                      onClick={async () => {
                        if (!id) return
                        if (!confirm('第1回戦の対戦表を再作成しますか？既存の対戦表は削除されます。')) return
                        try {
                          await rematchRound1(id)
                          alert('対戦表を再作成しました')
                          await loadMatches() // すべてのラウンドのマッチを読み込む
                        } catch (error: any) {
                          alert(error.response?.data?.message || '対戦表の再作成に失敗しました')
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      対戦表再作成
                    </button>
                  )}
                </div>
              )}

              {/* デバッグ情報 */}
              {(
                <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: isDark ? '#333' : '#f0f0f0', borderRadius: '4px', fontSize: '12px' }}>
                  <div><strong>予選順位表発表ボタンの表示条件:</strong></div>
                  <div>canEditTournament: {String(canEditTournament)}</div>
                  <div>isPreliminaryCompleted: {String(isPreliminaryCompleted)}</div>
                  <div style={{ marginTop: '5px', fontWeight: 'bold', color: (canEditTournament && isPreliminaryCompleted) ? 'green' : 'red' }}>
                    ボタン表示: {String(canEditTournament && isPreliminaryCompleted)}
                  </div>
                </div>
              )}

              {/* 予選順位表発表ボタン（管理者/開催者のみ、予選完了時） */}
              {canEditTournament && isPreliminaryCompleted && (
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  <button
                    onClick={async () => {
                      if (!id) return
                      if (!confirm('予選順位表を発表しますか？\n発表後、参加者に予選順位表が表示されます。')) return
                      try {
                        await announcePreliminaryStandings(id)
                        alert('予選順位表を発表しました')
                        await loadTournament()
                        // 予選順位発表後は必ず完了状態になる（バックエンドで未完了マッチを完了状態にしているため）
                        // checkPreliminaryStatus()を呼んで最新の状態を取得
                        await checkPreliminaryStatus()
                      } catch (error: any) {
                        console.error('Announce preliminary standings error:', error)
                        const errorMessage = error.response?.data?.message || error.message || '予選順位表の発表に失敗しました'
                        alert(errorMessage)
                      }
                    }}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      marginRight: '10px',
                    }}
                  >
                    予選順位表発表
                  </button>
                  <button
                    onClick={async () => {
                      if (!id) return
                      if (!confirm('決勝トーナメントをリセットしますか？\nすべての決勝トーナメントのマッチが削除されます。')) return
                      try {
                        await resetTournamentBracket(id)
                        alert('決勝トーナメントをリセットしました')
                        setTournamentBracket(null)
                        await loadTournament()
                        // トーナメントタブの場合は、決勝トーナメントデータを再読み込み
                        const bracket = await getTournamentBracket(id)
                        setTournamentBracket(bracket)
                      } catch (error: any) {
                        console.error('Reset tournament bracket error:', error)
                        const errorMessage = error.response?.data?.message || error.message || '決勝トーナメントのリセットに失敗しました'
                        alert(errorMessage)
                      }
                    }}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      marginRight: '10px',
                    }}
                  >
                    決勝トーナメントリセット
                  </button>
                  {(!tournamentBracket || tournamentBracket.rounds.length === 0) && (
                    <button
                      onClick={async () => {
                        if (!id) return
                        if (!confirm('決勝トーナメントを作成しますか？')) return
                        try {
                          setLoadingBracket(true)
                          await createTournamentBracket(id)
                          const bracket = await getTournamentBracket(id)
                          setTournamentBracket(bracket)
                          alert('決勝トーナメントを作成しました')
                          // 決勝トーナメント作成後、自動で表示されるようにする
                        } catch (error: any) {
                          alert(error.response?.data?.message || '決勝トーナメントの作成に失敗しました')
                        } finally {
                          setLoadingBracket(false)
                        }
                      }}
                      disabled={loadingBracket}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loadingBracket ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        fontSize: '16px',
                      }}
                    >
                      {loadingBracket ? '作成中...' : '決勝トーナメント作成'}
                    </button>
                  )}
                </div>
              )}

              {/* メインタブ（対戦カード / ランキング） */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: `2px solid ${isDark ? '#333' : '#ddd'}` }}>
                <button
                  onClick={() => setTournamentViewTab('matches')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: tournamentViewTab === 'matches' ? (isDark ? '#4CAF50' : '#FF9800') : 'transparent',
                    color: tournamentViewTab === 'matches' ? 'white' : (isDark ? '#aaa' : '#666'),
                    border: 'none',
                    borderBottom: tournamentViewTab === 'matches' ? `3px solid ${isDark ? '#4CAF50' : '#FF9800'}` : '3px solid transparent',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                  }}
                >
                  対戦カード
                </button>
                <button
                  onClick={() => setTournamentViewTab('ranking')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: tournamentViewTab === 'ranking' ? (isDark ? '#4CAF50' : '#FF9800') : 'transparent',
                    color: tournamentViewTab === 'ranking' ? 'white' : (isDark ? '#aaa' : '#666'),
                    border: 'none',
                    borderBottom: tournamentViewTab === 'ranking' ? `3px solid ${isDark ? '#4CAF50' : '#FF9800'}` : '3px solid transparent',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                  }}
                >
                  ランキング
                </button>
              </div>

              {!(tournament as any).matchesVisible && !canEditTournament ? (
                <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#aaa' : '#666' }}>
                  <p>対戦表はまだ公開されていません</p>
                </div>
              ) : tournamentViewTab === 'matches' ? (
                <div>
                  {/* 6回戦完了判定デバッグ情報 */}
                  {(() => {
                    const round6Matches = matches.filter(m => m.round === 6 && m.isTournamentMatch)
                    const round6Completed = round6Matches.filter(m => m.result != null).length
                    const round6Total = round6Matches.length
                    const round6IsCompleted = round6Total > 0 && round6Completed === round6Total
                    const round6IsActiveRound = tournament.currentRound === 6
                    const round6IsPastRound = 6 < (tournament.currentRound || 0)
                    return round6Matches.length > 0 && (
                      <div style={{
                        padding: '10px',
                        marginBottom: '15px',
                        backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: isDark ? '#fff' : '#333',
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>6回戦完了判定デバッグ:</div>
                        <div>round6Matches: {round6Matches.length}</div>
                        <div>round6Completed: {round6Completed}</div>
                        <div>round6Total: {round6Total}</div>
                        <div>round6IsCompleted: {round6IsCompleted ? 'true' : 'false'}</div>
                        <div>round6IsActiveRound: {round6IsActiveRound ? 'true' : 'false'}</div>
                        <div>round6IsPastRound: {round6IsPastRound ? 'true' : 'false'}</div>
                        <div>tournament.currentRound: {tournament.currentRound}</div>
                        <div>matches.length (全体): {matches.length}</div>
                        <div>matches.filter(round=6).length: {matches.filter(m => m.round === 6).length}</div>
                        <div style={{ marginTop: '5px', fontSize: '11px', opacity: 0.8 }}>
                          resultなしのマッチ: {round6Matches.filter(m => !m.result).map(m => m.id).join(', ') || 'なし'}
                        </div>
                      </div>
                    )
                  })()}
                  {/* 回戦タブ */}
                  {(() => {
                    // マッチから取得したラウンドと、tournament.currentRoundから推測されるラウンドを結合
                    const matchRounds = Array.from(new Set(matches.map(m => m.round)))
                    const maxRound = Math.max(
                      ...matchRounds,
                      tournament.currentRound || 1,
                      tournament.maxRounds || 1
                    )
                    // 1回戦から最大ラウンドまで全てのラウンドを生成
                    const allRounds = Array.from({ length: maxRound }, (_, i) => i + 1)
                    const rounds = Array.from(new Set([...allRounds, ...matchRounds])).sort((a, b) => a - b)
                    
                    const currentRoundMatches = matches.filter(m => m.round === selectedRound)
                    // プレビュー用のマッチ（isTournamentMatch: false）も含める
                    const previewMatches = currentRoundMatches.filter(m => !m.isTournamentMatch)
                    const activeMatches = currentRoundMatches.filter(m => m.isTournamentMatch)
                    // プレビュー用のマッチがある場合は、有効化されたマッチがあっても「開始」ボタンを表示
                    const hasPreview = previewMatches.length > 0
                    const completedCount = activeMatches.filter(m => m.result).length
                    const totalCount = activeMatches.length

                    return (
                      <div>
                        {/* ラウンド選択ボタン */}
                        <div style={{ 
                          display: 'flex', 
                          gap: isMobile ? '8px' : '10px', 
                          marginBottom: '20px', 
                          flexWrap: 'wrap',
                          padding: isMobile ? '10px 0' : '15px 0',
                          borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                        }}>
                          {rounds.map((round) => {
                            // 実際の対戦マッチのみをカウント（isTournamentMatch: true）
                            const roundMatches = matches.filter(m => m.round === round && m.isTournamentMatch)
                            // resultがnullでないことを確認
                            const roundCompleted = roundMatches.filter(m => m.result != null).length
                            const roundTotal = roundMatches.length
                            const isCurrentRound = round === selectedRound
                            const isActiveRound = round === tournament.currentRound
                            const isPastRound = round < (tournament.currentRound || 0)
                            const isRoundCompleted = roundTotal > 0 && roundCompleted === roundTotal
                            
                            // デバッグログ（6回戦の場合のみ）
                            if (round === 6) {
                              console.log(`[6回戦完了判定] matches.length: ${matches.length}, roundMatches: ${roundMatches.length}, roundCompleted: ${roundCompleted}, roundTotal: ${roundTotal}, isRoundCompleted: ${isRoundCompleted}`)
                              console.log(`[6回戦完了判定] isActiveRound: ${isActiveRound}, isPastRound: ${isPastRound}`)
                              console.log(`[6回戦完了判定] matches詳細:`, roundMatches.map(m => ({ id: m.id, result: m.result, isTournamentMatch: m.isTournamentMatch })))
                              console.log(`[6回戦完了判定] resultなしのマッチ:`, roundMatches.filter(m => !m.result).map(m => ({ id: m.id, result: m.result })))
                            }

                            return (
                              <button
                                key={round}
                                onClick={() => {
                                  setSelectedRound(round)
                                  // ラウンド選択時は、すべてのラウンドのマッチを読み込む（既に読み込まれている場合は更新のみ）
                                  loadMatches()
                                }}
                                style={{
                                  padding: isMobile ? '8px 16px' : '10px 20px',
                                  backgroundColor: isCurrentRound 
                                    ? (isRoundCompleted ? (isDark ? '#333' : '#e0e0e0') : (isActiveRound ? '#4CAF50' : (isDark ? '#333' : '#2196F3')))
                                    : (isActiveRound && !isRoundCompleted ? (isDark ? '#1a3a1a' : '#e8f5e9') : 'transparent'),
                                  color: isCurrentRound 
                                    ? (isRoundCompleted ? (isDark ? '#fff' : '#333') : 'white')
                                    : (isActiveRound && !isRoundCompleted
                                        ? (isDark ? '#4CAF50' : '#2e7d32')
                                        : (isPastRound 
                                            ? (isDark ? '#888' : '#999')
                                            : (isDark ? '#fff' : '#333'))),
                                  border: `2px solid ${
                                    isCurrentRound 
                                      ? (isRoundCompleted ? '#2196F3' : (isActiveRound ? '#4CAF50' : '#2196F3'))
                                      : (isActiveRound && !isRoundCompleted
                                          ? (isDark ? '#4CAF50' : '#4CAF50')
                                          : (isDark ? '#444' : '#ddd'))
                                  }`,
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontWeight: isCurrentRound ? 'bold' : (isActiveRound ? '600' : 'normal'),
                                  fontSize: isMobile ? '13px' : '14px',
                                  transition: 'all 0.2s',
                                  minWidth: isMobile ? '80px' : '100px',
                                  position: 'relative',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isCurrentRound) {
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isCurrentRound) {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = 'none'
                                  }
                                }}
                              >
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}>
                                  <div style={{ fontWeight: 'bold' }}>
                                    {round}回戦
                                  </div>
                                  {roundTotal > 0 && (
                                    <div style={{ 
                                      fontSize: isMobile ? '10px' : '11px',
                                      opacity: 0.9,
                                    }}>
                                      {roundCompleted}/{roundTotal}
                                    </div>
                                  )}
                                  {/* デバッグ情報（6回戦の場合のみ） */}
                                  {round === 6 && (
                                    <div style={{ 
                                      fontSize: '8px',
                                      marginTop: '2px',
                                      opacity: 0.6,
                                      color: isDark ? '#888' : '#999',
                                    }}>
                                      {isRoundCompleted ? '✓完了' : (isActiveRound ? '進行中' : '未開始')}
                                    </div>
                                  )}
                                  {isRoundCompleted ? (
                                    <div style={{ 
                                      fontSize: '9px',
                                      marginTop: '2px',
                                      opacity: 0.7,
                                      color: isDark ? '#4CAF50' : '#2e7d32',
                                      fontWeight: 'bold',
                                    }}>
                                      完了
                                    </div>
                                  ) : isActiveRound && (
                                    <div style={{ 
                                      fontSize: '9px',
                                      marginTop: '2px',
                                      opacity: 0.8,
                                    }}>
                                      実施中
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* プレビュー用の対戦表がある場合、「開始」ボタンを表示（既に開催中の回戦でも可） */}
                        {canEditTournament && hasPreview && (
                          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <div style={{ 
                              marginBottom: '15px',
                              padding: '15px',
                              backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                              borderRadius: '8px',
                              border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                            }}>
                              <p style={{ 
                                margin: '0 0 10px 0',
                                color: isDark ? '#fff' : '#333',
                                fontWeight: 'bold',
                              }}>
                                第{selectedRound}回戦の対戦表{activeMatches.length > 0 ? '（一部未開始）' : '（プレビュー）'}
                              </p>
                              <p style={{ 
                                margin: 0,
                                fontSize: '14px',
                                color: isDark ? '#aaa' : '#666',
                              }}>
                                {activeMatches.length > 0 
                                  ? '未開始の対戦表があります。「開始」ボタンを押すと参加者が結果を登録できるようになります'
                                  : '対戦表を確認し、「開始」ボタンを押すと参加者が結果を登録できるようになります'}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button
                                onClick={async () => {
                                  if (!id) return
                                  if (!confirm(`第${selectedRound}回戦の対戦表を再作成しますか？\n現在のプレビュー対戦表は削除され、新しい対戦表が作成されます。`)) return
                                  try {
                                    await rematchRound(id, selectedRound)
                                    alert(`第${selectedRound}回戦の対戦表を再作成しました`)
                                    await loadTournament()
                                    await loadMatches() // すべてのラウンドのマッチを読み込む
                                  } catch (error: any) {
                                    console.error('Rematch round error:', error)
                                    const errorMessage = error.response?.data?.message || error.message || '再マッチに失敗しました'
                                    alert(errorMessage)
                                  }
                                }}
                                style={{
                                  padding: '12px 24px',
                                  backgroundColor: '#FF9800',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '16px',
                                }}
                              >
                                再マッチ
                              </button>
                              <button
                                onClick={async () => {
                                  if (!id) return
                                  if (!confirm(`第${selectedRound}回戦を開始しますか？\n開始後、参加者が結果を登録できるようになります。`)) return
                                  try {
                                    await startRound(id, selectedRound)
                                    alert(`第${selectedRound}回戦を開始しました`)
                                    await loadTournament()
                                    await loadMatches() // すべてのラウンドのマッチを読み込む
                                  } catch (error: any) {
                                    console.error('Start round error:', error)
                                    const errorMessage = error.response?.data?.message || error.message || '回戦の開始に失敗しました'
                                    alert(errorMessage)
                                  }
                                }}
                                style={{
                                  padding: '12px 24px',
                                  backgroundColor: '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '16px',
                                }}
                              >
                                開始
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 全試合終了後の次の対戦表作成ボタン（開始済みの回戦には表示しない） */}
                        {canEditTournament && 
                         activeMatches.length > 0 && 
                         completedCount === totalCount && 
                         completedCount > 0 &&
                         tournament.currentRound && 
                         tournament.maxRounds && 
                         tournament.currentRound < tournament.maxRounds &&
                         selectedRound === tournament.currentRound && (
                          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <button
                              onClick={async () => {
                                if (!id) return
                                if (!confirm(`第${tournament.currentRound! + 1}回戦の対戦表を作成しますか？`)) return
                                try {
                                  const result = await createNextRound(id)
                                  alert(`第${result.round}回戦の対戦表を作成しました`)
                                  await loadTournament()
                                  setSelectedRound(result.round)
                                  await loadMatches() // すべてのラウンドのマッチを読み込む
                                } catch (error: any) {
                                  console.error('Create next round error:', error)
                                  console.error('Error response:', error.response?.data)
                                  const errorMessage = error.response?.data?.message || error.message || '次の対戦表の作成に失敗しました'
                                  const errorDetail = error.response?.data?.error ? `\n\n詳細:\n${error.response.data.error}` : ''
                                  const fullError = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.stack
                                  console.error('Full error details:', fullError)
                                  alert(`${errorMessage}${errorDetail}\n\nコンソールに詳細を出力しました。`)
                                }
                              }}
                              style={{
                                padding: '12px 24px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '16px',
                              }}
                            >
                              次の対戦表を作成
                            </button>
                          </div>
                        )}

                        {/* 対戦表表示（プレビュー用も含む） */}
                        {(previewMatches.length === 0 && activeMatches.length === 0) ? (
                          <p style={{ color: isDark ? '#aaa' : '#666' }}>対戦がありません</p>
                        ) : (
                          <div>
                            {/* 自分の対戦を一番上に独立して表示 */}
                            {(() => {
                              const myMatch = currentRoundMatches.find(
                                (m) => m.player1.user.id === user?.id || m.player2.user.id === user?.id
                              )
                              
                              if (!myMatch) return null

                              const player1Win = myMatch.result === 'player1'
                              const player2Win = myMatch.result === 'player2'
                              const isDraw = myMatch.result === 'draw'
                              const isBothLoss = (myMatch.result as string) === 'both_loss'

                              return (
                                <div style={{ marginBottom: '30px' }}>
                                  <div
                                    onClick={() => {
                                      setSelectedMatch(myMatch)
                                      setShowResultDialog(true)
                                    }}
                                    style={{
                                      padding: '15px',
                                      border: `2px solid ${isDark ? '#4CAF50' : '#4CAF50'}`,
                                      borderRadius: '8px',
                                      backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9',
                                      color: isDark ? '#fff' : '#333',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      maxWidth: '400px',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = 'scale(1.02)'
                                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = 'scale(1)'
                                      e.currentTarget.style.boxShadow = 'none'
                                    }}
                                  >
                                    {/* テーブル番号 */}
                                    <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '16px' }}>
                                      #{myMatch.round}-{myMatch.tableNumber || myMatch.matchNumber}
                                    </div>
                                    
                                    {/* プレイヤー1 */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <div style={{ fontSize: '14px', flex: 1 }}>
                                        {myMatch.player1.user.name}
                                      </div>
                                      <div
                                        style={{
                                          width: '35px',
                                          height: '35px',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 'bold',
                                          fontSize: '16px',
                                          backgroundColor: player1Win ? '#4CAF50' : (isDraw ? '#FF9800' : (isBothLoss ? '#F44336' : '#999')),
                                          color: 'white',
                                          marginLeft: '10px',
                                        }}
                                      >
                                        {player1Win ? '3' : (isDraw ? '1' : '0')}
                                      </div>
                                    </div>

                                    {/* プレイヤー2 */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ fontSize: '14px', flex: 1 }}>
                                        {myMatch.player2.user.name}
                                      </div>
                                      <div
                                        style={{
                                          width: '35px',
                                          height: '35px',
                                          borderRadius: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 'bold',
                                          fontSize: '16px',
                                          backgroundColor: player2Win ? '#4CAF50' : (isDraw ? '#FF9800' : (isBothLoss ? '#F44336' : '#999')),
                                          color: 'white',
                                          marginLeft: '10px',
                                        }}
                                      >
                                        {player2Win ? '3' : (isDraw ? '1' : '0')}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}

                            {/* 全テーブルリスト（テーブル番号順、自分の対戦も含む） */}
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile 
                                  ? 'repeat(2, 1fr)' 
                                  : 'repeat(4, 1fr)',
                                gap: isMobile ? '10px' : '12px',
                                padding: isMobile ? '10px 0' : '20px 0',
                              }}
                            >
                              {(hasPreview ? previewMatches : activeMatches)
                                .sort((a, b) => (a.tableNumber || 0) - (b.tableNumber || 0))
                                .map((match) => {
                                  const isMyMatch = match.player1.user.id === user?.id || match.player2.user.id === user?.id
                                  // プレビュー用のマッチ（isTournamentMatch: false）には結果を登録できない
                                  const canTap = (isMyMatch || canEditTournament) && match.isTournamentMatch
                                  const player1Win = match.result === 'player1'
                                  const player2Win = match.result === 'player2'
                                  const isDraw = match.result === 'draw'
                                  const isBothLoss = (match.result as string) === 'both_loss'
                                  const hasResult = !!match.result
                                  
                                  // スコア計算
                                  const player1Score = player1Win ? 1 : (isDraw ? 1 : (isBothLoss ? 0 : 0))
                                  const player2Score = player2Win ? 1 : (isDraw ? 1 : (isBothLoss ? 0 : 0))
                                  
                                  // スコアボックスの色
                                  const getScoreColor = (score: number, hasResult: boolean) => {
                                    if (!hasResult) return isDark ? '#666' : '#999'
                                    if (score === 1) return '#2196F3' // 青（勝利/引き分け）
                                    return isDark ? '#666' : '#999' // グレー（敗北/未登録）
                                  }

                                  // 背景色の決定：結果登録済みの場合は明るいグレー
                                  const getBackgroundColor = () => {
                                    if (hasResult) {
                                      // 結果登録済み：明るいグレー
                                      return isDark ? '#2a2a2a' : '#f5f5f5'
                                    }
                                    // 未登録：通常の背景
                                    if (isMyMatch) {
                                      return isDark ? '#1a3a1a' : '#e8f5e9'
                                    }
                                    return isDark ? '#1a1a1a' : '#fff'
                                  }

                                  return (
                                    <div
                                      key={match.id}
                                      style={{
                                        position: 'relative',
                                        padding: isMobile ? '10px' : '12px',
                                        border: `1px solid ${isMyMatch ? (isDark ? '#4CAF50' : '#4CAF50') : (isDark ? '#444' : '#ddd')}`,
                                        borderRadius: '8px',
                                        backgroundColor: getBackgroundColor(),
                                        color: isDark ? '#fff' : '#333',
                                        cursor: canTap ? 'pointer' : 'default',
                                        transition: 'all 0.2s',
                                        boxShadow: isMyMatch ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                      }}
                                      onClick={() => {
                                        if (canTap) {
                                          setSelectedMatch(match)
                                          setShowResultDialog(true)
                                        } else if (!match.isTournamentMatch) {
                                          alert('この対戦表はまだ開始されていません')
                                        }
                                      }}
                                      onMouseEnter={(e) => {
                                        if (canTap) {
                                          e.currentTarget.style.transform = 'translateY(-2px)'
                                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (canTap) {
                                          e.currentTarget.style.transform = 'translateY(0)'
                                          e.currentTarget.style.boxShadow = isMyMatch ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                        }
                                      }}
                                    >
                                      {/* ヘッダー: テーブル番号と編集ボタン */}
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        marginBottom: '8px',
                                      }}>
                                        <div style={{ 
                                          fontWeight: 'bold', 
                                          fontSize: isMobile ? '12px' : '13px',
                                          color: isDark ? '#aaa' : '#666',
                                        }}>
                                          #{match.round}-{match.tableNumber || match.matchNumber}
                                        </div>
                                        {canEditTournament && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setSelectedMatch(match)
                                              setShowResultDialog(true)
                                            }}
                                            style={{
                                              padding: '2px 6px',
                                              fontSize: '10px',
                                              backgroundColor: 'transparent',
                                              color: isDark ? '#aaa' : '#666',
                                              border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                                              borderRadius: '4px',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            編集
                                          </button>
                                        )}
                                      </div>
                                      
                                      {/* プレイヤー1 */}
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        marginBottom: '8px',
                                        gap: '8px',
                                      }}>
                                        {/* アバター */}
                                        <div
                                          style={{
                                            width: isMobile ? '28px' : '32px',
                                            height: isMobile ? '28px' : '32px',
                                            borderRadius: '50%',
                                            backgroundColor: isDark ? '#333' : '#e0e0e0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: isMobile ? '12px' : '14px',
                                            fontWeight: 'bold',
                                            color: isDark ? '#fff' : '#333',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {match.player1.user.name.charAt(0).toUpperCase()}
                                        </div>
                                        
                                        {/* プレイヤー名 */}
                                        <div style={{ 
                                          flex: 1,
                                          fontSize: isMobile ? '11px' : '12px',
                                          minWidth: 0,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '2px',
                                        }}>
                                          <div style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}>
                                            {match.player1.user.name}
                                          </div>
                                          {match.player1.pointsBeforeRound !== undefined && (
                                            <div style={{
                                              fontSize: isMobile ? '9px' : '10px',
                                              color: isDark ? '#aaa' : '#666',
                                              fontWeight: 'normal',
                                            }}>
                                              {match.player1.pointsBeforeRound}点
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* スコアボックス */}
                                        <div
                                          style={{
                                            width: isMobile ? '24px' : '28px',
                                            height: isMobile ? '24px' : '28px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: isMobile ? '12px' : '13px',
                                            backgroundColor: getScoreColor(player1Score, !!match.result),
                                            color: 'white',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {player1Score}
                                        </div>
                                      </div>

                                      {/* プレイヤー2 */}
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        gap: '8px',
                                      }}>
                                        {/* アバター */}
                                        <div
                                          style={{
                                            width: isMobile ? '28px' : '32px',
                                            height: isMobile ? '28px' : '32px',
                                            borderRadius: '50%',
                                            backgroundColor: isDark ? '#333' : '#e0e0e0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: isMobile ? '12px' : '14px',
                                            fontWeight: 'bold',
                                            color: isDark ? '#fff' : '#333',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {match.player2.user.name.charAt(0).toUpperCase()}
                                        </div>
                                        
                                        {/* プレイヤー名 */}
                                        <div style={{ 
                                          flex: 1,
                                          fontSize: isMobile ? '11px' : '12px',
                                          minWidth: 0,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '2px',
                                        }}>
                                          <div style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}>
                                            {match.player2.user.name}
                                          </div>
                                          {match.player2.pointsBeforeRound !== undefined && (
                                            <div style={{
                                              fontSize: isMobile ? '9px' : '10px',
                                              color: isDark ? '#aaa' : '#666',
                                              fontWeight: 'normal',
                                            }}>
                                              {match.player2.pointsBeforeRound}点
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* スコアボックス */}
                                        <div
                                          style={{
                                            width: isMobile ? '24px' : '28px',
                                            height: isMobile ? '24px' : '28px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: isMobile ? '12px' : '13px',
                                            backgroundColor: getScoreColor(player2Score, !!match.result),
                                            color: 'white',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {player2Score}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div>
                  {/* ランキング表示 */}
                  {standings.length === 0 ? (
                    <p style={{ color: isDark ? '#aaa' : '#666' }}>順位データがありません</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          backgroundColor: isDark ? '#1a1a1a' : '#fff',
                          color: isDark ? '#fff' : '#333',
                        }}
                      >
                        <thead>
                          <tr style={{ borderBottom: `2px solid ${isDark ? '#333' : '#ddd'}` }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>順位</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>プレイヤー名</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>勝敗数</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>点累計</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>OMW%</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>勝手累点</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>OOMW%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings
                            .filter((standing) => standing.participant.checkedIn) // チェックイン済みの参加者のみ表示
                            .sort((a, b) => {
                              // 1. 累計得点
                              if (a.points !== b.points) {
                                return b.points - a.points
                              }
                              // 2. OMW%
                              if (a.omw !== b.omw) {
                                return b.omw - a.omw
                              }
                              // 3. 勝手累点
                              const aGameWins = a.gameWins || a.participant.wins
                              const bGameWins = b.gameWins || b.participant.wins
                              if (aGameWins !== bGameWins) {
                                return bGameWins - aGameWins
                              }
                              // 4. 平均OMW%
                              if (a.averageOmw !== b.averageOmw) {
                                return b.averageOmw - a.averageOmw
                              }
                              return 0
                            })
                            .map((standing, index) => {
                              const isMyRow = standing.participant.userId === user?.id
                              // 決勝トーナメント進出人数のボーダーライン（tournamentSizeで判定）
                              const cutLine = tournament?.tournamentSize || 0
                              const isCutLine = cutLine > 0 && index + 1 === cutLine
                              return (
                                <tr
                                  key={standing.participant.id}
                                  style={{
                                    borderBottom: isCutLine 
                                      ? `3px solid ${isDark ? '#FF9800' : '#FF5722'}` 
                                      : `1px solid ${isDark ? '#333' : '#ddd'}`,
                                    backgroundColor: isMyRow ? (isDark ? '#2a3a2a' : '#e8f5e9') : 'transparent',
                                    fontWeight: isMyRow ? 'bold' : 'normal',
                                  }}
                                >
                                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{index + 1}</td>
                                  <td style={{ padding: '12px', fontWeight: isMyRow ? 'bold' : 'normal' }}>{standing.participant.user.name}</td>
                                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: isMyRow ? 'bold' : 'normal' }}>
                                    {standing.participant.wins}-{standing.participant.losses}-{standing.participant.draws}
                                  </td>
                                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: isMyRow ? 'bold' : 'normal' }}>{standing.points}</td>
                                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: isMyRow ? 'bold' : 'normal' }}>
                                    {standing.omw ? (Math.round(standing.omw * 1000) / 10).toFixed(1) : '0.0'}%
                                  </td>
                                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: isMyRow ? 'bold' : 'normal' }}>{standing.gameWins || standing.participant.wins}</td>
                                  <td style={{ padding: '12px', textAlign: 'center', fontWeight: isMyRow ? 'bold' : 'normal' }}>
                                    {standing.averageOmw ? (standing.averageOmw * 100).toFixed(2) : '0.00'}%
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: isDark ? '#aaa' : '#666' }}>
              <p>大会はまだ開始されていません</p>
              <p>マッチング発表後に表示されます</p>
            </div>
          )}

          {/* 決勝トーナメント表示 */}
          {tournamentBracket && tournamentBracket.rounds.length > 0 && (
            <div style={{ marginTop: '40px', padding: '20px 0' }}>
              <h3 style={{ 
                color: isDark ? '#fff' : '#333', 
                marginBottom: '20px',
                fontSize: '20px',
                fontWeight: 'bold',
                textAlign: 'center',
              }}>
                決勝トーナメント
              </h3>
              <TournamentBracketDisplay
                bracket={tournamentBracket}
                user={user}
                isDark={isDark}
                onWinnerSelect={async (matchId: string, winnerId: string) => {
                  if (!id) return
                  try {
                    // 勝者を登録
                    const match = tournamentBracket.matches.find(m => m.id === matchId)
                    if (!match) return
                    
                    const result = match.player1Id === winnerId ? 'player1' : 'player2'
                    await reportMatchResult(id, matchId, result)
                    
                    // ブラケットを再読み込み
                    const updatedBracket = await getTournamentBracket(id)
                    setTournamentBracket(updatedBracket)
                    // マッチも再読み込み
                    await loadMatches()
                  } catch (error: any) {
                    alert(error.response?.data?.message || '結果の登録に失敗しました')
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* アナウンスタブ */}
      {activeTab === 'announcement' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}
          >
            <h2 style={{ color: isDark ? '#fff' : '#333' }}>アナウンス</h2>
            {canEditAnnouncement && !isEditingAnnouncement && (
              <button
                onClick={() => {
                  setEditingAnnouncement(announcement)
                  setIsEditingAnnouncement(true)
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                編集
              </button>
            )}
          </div>

          {isEditingAnnouncement ? (
            <div>
              <textarea
                value={editingAnnouncement}
                onChange={(e) => setEditingAnnouncement(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: '12px',
                  border: `1px solid ${isDark ? '#333' : '#ddd'}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  marginBottom: '15px',
                  backgroundColor: isDark ? '#1a1a1a' : '#fff',
                  color: isDark ? '#fff' : '#333',
                }}
                placeholder="アナウンスを入力してください"
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSaveAnnouncement}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsEditingAnnouncement(false)
                    setEditingAnnouncement('')
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#999',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '20px',
                backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9',
                borderRadius: '8px',
                minHeight: '200px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                color: isDark ? '#fff' : '#333',
                border: isDark ? '1px solid #333' : 'none',
              }}
            >
              {announcement || <span style={{ color: isDark ? '#666' : '#999' }}>アナウンスはありません</span>}
            </div>
          )}
        </div>
      )}

      {/* 勝敗登録ダイアログ */}
      {showResultDialog && selectedMatch && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
          onClick={() => {
            setShowResultDialog(false)
            setSelectedMatch(null)
          }}
        >
          <div
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#fff',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              color: isDark ? '#fff' : '#333',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: isDark ? '#fff' : '#333' }}>
              勝敗登録
            </h2>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>
                テーブル {selectedMatch.tableNumber || '-'}
              </p>
              <p style={{ marginBottom: '20px', fontSize: '18px' }}>
                <strong>{selectedMatch.player1.user.name}</strong> vs <strong>{selectedMatch.player2.user.name}</strong>
              </p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              {(() => {
                // 自分の対戦かどうかを判定
                const isMyMatch = selectedMatch.player1.user.id === user?.id || selectedMatch.player2.user.id === user?.id
                const hasResult = !!selectedMatch.result
                
                // 参加者の場合、結果が登録されている場合はボタンを非表示にして結果を表示
                // 管理者/開催者の場合、結果が登録されていても変更可能
                if (hasResult && isMyMatch && !canEditTournament) {
                  // 参加者で結果が登録されている場合、結果テキストを表示
                  let resultText = ''
                  if (selectedMatch.result === 'player1') {
                    resultText = `${selectedMatch.player1.user.name}選手の勝利です`
                  } else if (selectedMatch.result === 'player2') {
                    resultText = `${selectedMatch.player2.user.name}選手の勝利です`
                  } else if (selectedMatch.result === 'draw') {
                    resultText = '引き分け(両者勝ち点1)です'
                  } else if (selectedMatch.result === 'both_loss') {
                    resultText = '両者敗北(両者0点)です'
                  }
                  
                  return (
                    <div style={{ 
                      padding: '20px', 
                      backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: isDark ? '#fff' : '#333',
                    }}>
                      {resultText}
                    </div>
                  )
                }
                
                // 結果が未登録、または管理者/開催者の場合、ボタンを表示
                return (
                  <>
                    <p style={{ marginBottom: '15px', fontWeight: 'bold' }}>勝者を選択してください：</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button
                        onClick={async () => {
                          if (!id) return
                          try {
                            await reportMatchResult(id, selectedMatch.id, 'player1')
                            await loadMatches() // すべてのラウンドのマッチを再読み込み
                            await loadStandings() // ランキングを再読み込み
                            // 予選完了判定を再チェック
                            await checkPreliminaryStatus()
                            setShowResultDialog(false)
                            setSelectedMatch(null)
                            alert('結果を登録しました')
                          } catch (error: any) {
                            alert(error.response?.data?.message || '結果の登録に失敗しました')
                          }
                        }}
                        style={{
                          padding: '12px 20px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          textAlign: 'left',
                        }}
                      >
                        ✓ {selectedMatch.player1.user.name} の勝利
                      </button>
                      <button
                        onClick={async () => {
                          if (!id) return
                          try {
                            await reportMatchResult(id, selectedMatch.id, 'player2')
                            await loadMatches() // すべてのラウンドのマッチを再読み込み
                            await loadStandings() // ランキングを再読み込み
                            // 予選完了判定を再チェック
                            await checkPreliminaryStatus()
                            setShowResultDialog(false)
                            setSelectedMatch(null)
                            alert('結果を登録しました')
                          } catch (error: any) {
                            alert(error.response?.data?.message || '結果の登録に失敗しました')
                          }
                        }}
                        style={{
                          padding: '12px 20px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          textAlign: 'left',
                        }}
                      >
                        ✓ {selectedMatch.player2.user.name} の勝利
                      </button>
                      <button
                        onClick={async () => {
                          if (!id) return
                          try {
                            await reportMatchResult(id, selectedMatch.id, 'draw')
                            await loadMatches() // すべてのラウンドのマッチを再読み込み
                            await loadStandings() // ランキングを再読み込み
                            // 予選完了判定を再チェック
                            await checkPreliminaryStatus()
                            setShowResultDialog(false)
                            setSelectedMatch(null)
                            alert('結果を登録しました')
                          } catch (error: any) {
                            alert(error.response?.data?.message || '結果の登録に失敗しました')
                          }
                        }}
                        style={{
                          padding: '12px 20px',
                          backgroundColor: '#FF9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          textAlign: 'left',
                        }}
                      >
                        ✓ 引き分け(両者勝ち点1)
                      </button>
                      {canEditTournament && (
                        <button
                          onClick={async () => {
                            if (!id) return
                            try {
                              await reportMatchResult(id, selectedMatch.id, 'both_loss')
                              await loadMatches() // すべてのラウンドのマッチを再読み込み
                              await loadStandings() // ランキングを再読み込み
                              // 予選完了判定を再チェック
                              await checkPreliminaryStatus()
                              setShowResultDialog(false)
                              setSelectedMatch(null)
                              alert('結果を登録しました')
                            } catch (error: any) {
                              alert(error.response?.data?.message || '結果の登録に失敗しました')
                            }
                          }}
                          style={{
                            padding: '12px 20px',
                            backgroundColor: '#F44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            textAlign: 'left',
                          }}
                        >
                          ✓ 両者敗北(両者0点)
                        </button>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              {(() => {
                const isMyMatch = selectedMatch.player1.user.id === user?.id || selectedMatch.player2.user.id === user?.id
                const hasResult = !!selectedMatch.result
                // 参加者で結果が登録されている場合は「OK」、それ以外は「キャンセル」
                const buttonText = (hasResult && isMyMatch && !canEditTournament) ? 'OK' : 'キャンセル'
                
                return (
                  <button
                    onClick={() => {
                      setShowResultDialog(false)
                      setSelectedMatch(null)
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: buttonText === 'OK' ? '#4CAF50' : '#999',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    {buttonText}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 固定エントリーボタン（画面下部）- 編集モードの時は非表示 */}
      {activeTab === 'details' && !isEditing && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: isDark ? '#1a1a1a' : '#fff',
            borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
            padding: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: isDark ? '0 -2px 8px rgba(0,0,0,0.5)' : '0 -2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
          }}
        >
          {renderEntryButton()}
        </div>
      )}
    </div>
  )
}
