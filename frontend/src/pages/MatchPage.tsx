import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Match, Tournament } from '../types'
import { getTournament, getMatches, getMyMatch, reportMatchResult } from '../api/tournaments'
import { useAuthStore } from '../stores/authStore'
import BackButton from '../components/BackButton'

export default function MatchPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [myMatch, setMyMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)

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

  const handleReportResult = async (matchId: string, result: 'player1' | 'player2' | 'draw') => {
    if (!id) return
    try {
      await reportMatchResult(id, matchId, result)
      alert('結果を登録しました')
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || '結果の登録に失敗しました')
    }
  }

  if (loading) {
    return <div>読み込み中...</div>
  }

  if (!tournament) {
    return <div>大会が見つかりません</div>
  }

  const canReportResult = (match: Match) => {
    if (!user) return false
    if (match.result) return false // 既に結果が登録されている
    return (
      (match.player1.userId === user.id || match.player2.userId === user.id) &&
      match.player1.userId !== match.player2.userId // 自分自身との対戦でない
    )
  }

  return (
    <div>
      <BackButton to={`/tournaments/${id}`} />
      <h1>{tournament.name}</h1>
      <h2>第{tournament.currentRound}回戦</h2>

      {myMatch && (
        <div
          style={{
            marginTop: '20px',
            padding: '20px',
            border: '2px solid #4CAF50',
            borderRadius: '8px',
            backgroundColor: '#f0f8f0',
          }}
        >
          <h3>あなたの対戦</h3>
          <p>
            <strong>テーブル番号:</strong> {myMatch.tableNumber || '未設定'}
          </p>
          <p>
            <strong>対戦相手:</strong>{' '}
            {myMatch.player1.userId === user?.id
              ? myMatch.player2.user.name
              : myMatch.player1.user.name}
          </p>
          {myMatch.result ? (
            <p>
              <strong>結果:</strong>{' '}
              {myMatch.result === 'player1' && myMatch.player1.userId === user?.id && '勝利'}
              {myMatch.result === 'player2' && myMatch.player2.userId === user?.id && '勝利'}
              {myMatch.result === 'draw' && '引き分け'}
              {(myMatch.result === 'player1' && myMatch.player1.userId !== user?.id) ||
              (myMatch.result === 'player2' && myMatch.player2.userId !== user?.id)
                ? '敗北'
                : ''}
            </p>
          ) : canReportResult(myMatch) ? (
            <div>
              <p>結果を登録してください（勝った方が登録します）</p>
              <div style={{ marginTop: '10px' }}>
                <button
                  onClick={() =>
                    handleReportResult(
                      myMatch.id,
                      myMatch.player1.userId === user?.id ? 'player1' : 'player2'
                    )
                  }
                  style={{ marginRight: '10px' }}
                >
                  勝利
                </button>
                <button
                  onClick={() =>
                    handleReportResult(
                      myMatch.id,
                      myMatch.player1.userId === user?.id ? 'player2' : 'player1'
                    )
                  }
                  style={{ marginRight: '10px' }}
                >
                  敗北
                </button>
                <button onClick={() => handleReportResult(myMatch.id, 'draw')}>引き分け</button>
              </div>
            </div>
          ) : (
            <p>結果待ち</p>
          )}
        </div>
      )}

      <div style={{ marginTop: '40px' }}>
        <h3>全対戦一覧</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>テーブル</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>プレイヤー1</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>プレイヤー2</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>結果</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {match.tableNumber || '-'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {match.player1.user.name}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {match.player2.user.name}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {match.result
                    ? match.result === 'player1'
                      ? `${match.player1.user.name} の勝利`
                      : match.result === 'player2'
                      ? `${match.player2.user.name} の勝利`
                      : '引き分け'
                    : '未登録'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

