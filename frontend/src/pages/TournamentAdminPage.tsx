import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Tournament, Participant, Match } from '../types'
import BackButton from '../components/BackButton'
import {
  getTournament,
  getParticipants,
  getMatches,
  startTournament,
  generatePairings,
  updateMatchPoints,
  dropParticipant,
  rematchRound,
} from '../api/tournaments'

export default function TournamentAdminPage() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    if (!id) return
    try {
      const [tournamentData, participantsData, matchesData] = await Promise.all([
        getTournament(id),
        getParticipants(id),
        getMatches(id),
      ])
      setTournament(tournamentData)
      setParticipants(participantsData)
      setMatches(matchesData)
    } catch (error) {
      console.error('データの取得に失敗しました', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTournament = async () => {
    if (!id) return
    if (!confirm('大会を開始しますか？')) return
    try {
      await startTournament(id)
      alert('大会を開始しました')
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || '大会の開始に失敗しました')
    }
  }

  const handleGeneratePairings = async () => {
    if (!id || !tournament) return
    if (!confirm('マッチングを生成しますか？')) return
    try {
      await generatePairings(id, tournament.currentRound + 1)
      alert('マッチングを生成しました')
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || 'マッチングの生成に失敗しました')
    }
  }

  const handleRematch = async () => {
    if (!id || !tournament) return
    if (!confirm('この回戦を再マッチングしますか？')) return
    try {
      await rematchRound(id, tournament.currentRound)
      alert('再マッチングを完了しました')
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || '再マッチングに失敗しました')
    }
  }

  const handleDropParticipant = async (participantId: string) => {
    if (!id) return
    if (!confirm('この参加者を棄権させますか？')) return
    try {
      await dropParticipant(id, participantId)
      alert('棄権処理を完了しました')
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.message || '棄権処理に失敗しました')
    }
  }

  if (loading) {
    return <div>読み込み中...</div>
  }

  if (!tournament) {
    return <div>大会が見つかりません</div>
  }

  return (
    <div>
      <BackButton to={`/tournaments/${id}`} />
      <h1>大会管理: {tournament.name}</h1>

      <div style={{ marginTop: '20px' }}>
        <h2>大会操作</h2>
        {tournament.status === 'registration' && (
          <button onClick={handleStartTournament}>大会を開始</button>
        )}
        {tournament.status === 'in_progress' && (
          <div>
            <button onClick={handleGeneratePairings} style={{ marginRight: '10px' }}>
              次回戦のマッチングを生成
            </button>
            <button onClick={handleRematch}>現在の回戦を再マッチング</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>参加者一覧 ({participants.length}名)</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>名前</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>チェックイン</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>勝敗</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>得点</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant.id}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {participant.user.name}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {participant.checkedIn ? '✓' : '×'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {participant.wins}-{participant.losses}-{participant.draws}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{participant.points}</td>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                  {!participant.dropped && (
                    <button onClick={() => handleDropParticipant(participant.id)}>棄権</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tournament.status === 'in_progress' && (
        <div style={{ marginTop: '30px' }}>
          <h2>対戦一覧</h2>
          {matches.length === 0 ? (
            <p>対戦がありません</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>回戦</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>テーブル</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>プレイヤー1</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>プレイヤー2</th>
                  <th style={{ border: '1px solid #ccc', padding: '8px' }}>結果</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id}>
                    <td style={{ border: '1px solid #ccc', padding: '8px' }}>{match.round}</td>
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
          )}
        </div>
      )}
    </div>
  )
}

