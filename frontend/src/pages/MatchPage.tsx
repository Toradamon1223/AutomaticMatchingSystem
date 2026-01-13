import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Match, Tournament } from '../types'
import { getTournament, getMatches, getMyMatch, reportMatchResult } from '../api/tournaments'
import { useAuthStore } from '../stores/authStore'
import BackButton from '../components/BackButton'

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

export default function MatchPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const isDark = useDarkMode()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [myMatch, setMyMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    if (!id) return
    try {
      const tournamentData = await getTournament(id)
      setTournament(tournamentData)

      const matchesData = await getMatches(id, tournamentData.currentRound)
      setMatches(matchesData)

      if (tournamentData.currentRound) {
        const myMatchData = await getMyMatch(id, tournamentData.currentRound)
        setMyMatch(myMatchData)
      }
    } catch (error) {
      console.error('データの取得に失敗しました', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReportResult = async (matchId: string, result: 'player1' | 'player2' | 'draw' | 'both_loss') => {
    if (!id) return
    try {
      await reportMatchResult(id, matchId, result)
      alert('結果を登録しました')
      loadData()
      setShowResultDialog(false)
      setSelectedMatch(null)
    } catch (error: any) {
      alert(error.response?.data?.message || '結果の登録に失敗しました')
    }
  }

  if (loading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        color: isDark ? '#fff' : '#333' 
      }}>
        読み込み中...
      </div>
    )
  }

  if (!tournament) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        color: isDark ? '#fff' : '#333' 
      }}>
        大会が見つかりません
      </div>
    )
  }

  // 管理者/主催者の権限チェック
  const isOrganizer = (user?.role === 'organizer' || user?.role === 'admin') && tournament.organizerId === user?.id
  const isAdmin = user?.role === 'admin'
  const canEditTournament = isOrganizer || isAdmin

  const canReportResult = (match: Match) => {
    if (!user) return false
    // 管理者/主催者は常に結果を変更可能
    if (canEditTournament) return true
    // 参加者は結果が未登録の場合のみ登録可能
    if (match.result) return false
    return (
      (match.player1.userId === user.id || match.player2.userId === user.id) &&
      match.player1.userId !== match.player2.userId // 自分自身との対戦でない
    )
  }

  const canTapMatch = (match: Match) => {
    if (!user) return false
    // 管理者/主催者は常にタップ可能
    if (canEditTournament) return true
    // 参加者は自分の対戦のみタップ可能
    return match.player1.userId === user.id || match.player2.userId === user.id
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: isDark ? '#121212' : '#f5f5f5',
      padding: '20px',
      color: isDark ? '#fff' : '#333',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <BackButton to={`/tournaments/${id}`} />
        <h1 style={{ 
          marginTop: '20px', 
          marginBottom: '10px',
          color: isDark ? '#fff' : '#333',
        }}>
          {tournament.name}
        </h1>
        <h2 style={{ 
          marginTop: '10px', 
          marginBottom: '30px',
          color: isDark ? '#aaa' : '#666',
          fontSize: '20px',
        }}>
          第{tournament.currentRound}回戦
        </h2>

        {myMatch && (
          <div
            style={{
              marginTop: '20px',
              marginBottom: '30px',
              padding: '24px',
              border: `2px solid ${isDark ? '#4CAF50' : '#4CAF50'}`,
              borderRadius: '12px',
              backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: '16px',
              color: isDark ? '#4CAF50' : '#2e7d32',
            }}>
              あなたの対戦
            </h3>
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: isDark ? '#fff' : '#333' }}>テーブル番号:</strong>{' '}
              <span style={{ color: isDark ? '#aaa' : '#666' }}>
                {myMatch.tableNumber || '未設定'}
              </span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong style={{ color: isDark ? '#fff' : '#333' }}>対戦相手:</strong>{' '}
              <span style={{ color: isDark ? '#aaa' : '#666' }}>
                {myMatch.player1.userId === user?.id
                  ? myMatch.player2.user.name
                  : myMatch.player1.user.name}
              </span>
            </div>
            {myMatch.result ? (
              <div style={{ 
                padding: '12px', 
                backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                borderRadius: '8px',
                marginTop: '12px',
              }}>
                <strong style={{ color: isDark ? '#fff' : '#333' }}>結果:</strong>{' '}
                <span style={{ 
                  color: isDark ? '#fff' : '#333',
                  fontWeight: 'bold',
                }}>
                  {myMatch.result === 'player1' && myMatch.player1.userId === user?.id && '勝利'}
                  {myMatch.result === 'player2' && myMatch.player2.userId === user?.id && '勝利'}
                  {myMatch.result === 'draw' && '引き分け'}
                  {myMatch.result === 'both_loss' && '両者敗北'}
                  {(myMatch.result === 'player1' && myMatch.player1.userId !== user?.id) ||
                  (myMatch.result === 'player2' && myMatch.player2.userId !== user?.id)
                    ? '敗北'
                    : ''}
                </span>
                {canEditTournament && (
                  <button
                    onClick={() => {
                      setSelectedMatch(myMatch)
                      setShowResultDialog(true)
                    }}
                    style={{
                      marginLeft: '12px',
                      padding: '6px 12px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    結果を変更
                  </button>
                )}
              </div>
            ) : canReportResult(myMatch) ? (
              <div>
                <p style={{ marginBottom: '12px', color: isDark ? '#aaa' : '#666' }}>
                  結果を登録してください
                </p>
                <button
                  onClick={() => {
                    setSelectedMatch(myMatch)
                    setShowResultDialog(true)
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                  }}
                >
                  結果を登録
                </button>
              </div>
            ) : (
              <p style={{ color: isDark ? '#aaa' : '#666' }}>結果待ち</p>
            )}
          </div>
        )}

        <div style={{ marginTop: '40px' }}>
          <h3 style={{ 
            marginBottom: '20px',
            color: isDark ? '#fff' : '#333',
          }}>
            全対戦一覧
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              backgroundColor: isDark ? '#1a1a1a' : '#fff',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <thead>
                <tr style={{ 
                  backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                  borderBottom: `2px solid ${isDark ? '#333' : '#ddd'}`,
                }}>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: isDark ? '#fff' : '#333',
                  }}>
                    テーブル
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: isDark ? '#fff' : '#333',
                  }}>
                    プレイヤー1
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: isDark ? '#fff' : '#333',
                  }}>
                    プレイヤー2
                  </th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: isDark ? '#fff' : '#333',
                  }}>
                    結果
                  </th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const isMyMatch = match.player1.userId === user?.id || match.player2.userId === user?.id
                  const canTap = canTapMatch(match)
                  
                  let resultText = '未登録'
                  let resultColor = isDark ? '#666' : '#999'
                  
                  if (match.result) {
                    if (match.result === 'player1') {
                      resultText = `${match.player1.user.name} の勝利`
                      resultColor = '#4CAF50'
                    } else if (match.result === 'player2') {
                      resultText = `${match.player2.user.name} の勝利`
                      resultColor = '#4CAF50'
                    } else if (match.result === 'draw') {
                      resultText = '引き分け'
                      resultColor = '#FF9800'
                    } else if (match.result === 'both_loss') {
                      resultText = '両者敗北'
                      resultColor = '#F44336'
                    }
                  }

                  return (
                    <tr 
                      key={match.id}
                      style={{
                        borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                        backgroundColor: isMyMatch ? (isDark ? '#1a3a1a' : '#e8f5e9') : 'transparent',
                        cursor: canTap ? 'pointer' : 'default',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (canTap) {
                          e.currentTarget.style.backgroundColor = isDark ? '#2a2a2a' : '#f0f0f0'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (canTap) {
                          e.currentTarget.style.backgroundColor = isMyMatch 
                            ? (isDark ? '#1a3a1a' : '#e8f5e9') 
                            : 'transparent'
                        }
                      }}
                      onClick={() => {
                        if (canTap) {
                          setSelectedMatch(match)
                          setShowResultDialog(true)
                        }
                      }}
                    >
                      <td style={{ 
                        padding: '12px',
                        color: isDark ? '#fff' : '#333',
                      }}>
                        {match.tableNumber || '-'}
                      </td>
                      <td style={{ 
                        padding: '12px',
                        color: isDark ? '#fff' : '#333',
                      }}>
                        {match.player1.user.name}
                      </td>
                      <td style={{ 
                        padding: '12px',
                        color: isDark ? '#fff' : '#333',
                      }}>
                        {match.player2.user.name}
                      </td>
                      <td style={{ 
                        padding: '12px',
                        color: resultColor,
                        fontWeight: match.result ? 'bold' : 'normal',
                      }}>
                        {resultText}
                        {canEditTournament && match.result && (
                          <span style={{ 
                            marginLeft: '8px',
                            fontSize: '12px',
                            color: isDark ? '#aaa' : '#666',
                          }}>
                            (変更可)
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 結果入力ダイアログ */}
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
            <h2 style={{ 
              marginTop: 0, 
              marginBottom: '20px',
              color: isDark ? '#fff' : '#333',
            }}>
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
                const isMyMatch = selectedMatch.player1.userId === user?.id || selectedMatch.player2.userId === user?.id
                const isPlayer1 = selectedMatch.player1.userId === user?.id
                const hasResult = !!selectedMatch.result
                
                // 参加者の場合、結果が登録されている場合は結果を表示（管理者/主催者は変更可能）
                if (hasResult && isMyMatch && !canEditTournament) {
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
                    <p style={{ marginBottom: '15px', fontWeight: 'bold' }}>
                      {canEditTournament && hasResult ? '結果を変更してください：' : '勝者を選択してください：'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button
                        onClick={() => handleReportResult(selectedMatch.id, 'player1')}
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
                        onClick={() => handleReportResult(selectedMatch.id, 'player2')}
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
                        onClick={() => handleReportResult(selectedMatch.id, 'draw')}
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
                          onClick={() => handleReportResult(selectedMatch.id, 'both_loss')}
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
              <button
                onClick={() => {
                  setShowResultDialog(false)
                  setSelectedMatch(null)
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#999',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

