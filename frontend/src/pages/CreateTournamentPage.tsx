import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTournament } from '../api/tournaments'
import BackButton from '../components/BackButton'

export default function CreateTournamentPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [preliminaryRounds, setPreliminaryRounds] = useState<
    number | 'until_one_undefeated' | 'until_two_undefeated'
  >(3)
  const [tournamentSize, setTournamentSize] = useState<4 | 8 | 16 | 32>(8)
  const [entryStartAt, setEntryStartAt] = useState('')
  const [entryEndAt, setEntryEndAt] = useState('')
  const [capacity, setCapacity] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [registrationTime, setRegistrationTime] = useState('')
  const [startTime, setStartTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 日付と時間を組み合わせて送信
      let eventDateValue: string | undefined = undefined
      let registrationTimeValue: string | undefined = undefined
      let startTimeValue: string | undefined = undefined

      if (eventDate) {
        eventDateValue = eventDate
      }
      if (eventDate && registrationTime) {
        registrationTimeValue = `${eventDate}T${registrationTime}:00`
      }
      if (eventDate && startTime) {
        startTimeValue = `${eventDate}T${startTime}:00`
      }

      const tournament = await createTournament({
        name,
        description,
        preliminaryRounds,
        tournamentSize,
        entryStartAt: entryStartAt || undefined,
        entryEndAt: entryEndAt || undefined,
        capacity: capacity ? parseInt(capacity) : undefined,
        eventDate: eventDateValue,
        registrationTime: registrationTimeValue,
        startTime: startTimeValue,
      })
      navigate(`/tournaments/${tournament.id}/admin`)
    } catch (err: any) {
      setError(err.response?.data?.message || '大会の作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <BackButton to="/" />
      <h1>新しい大会を作成</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>
            大会名 *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            説明
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '100px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            予選回戦数 *
            <select
              value={preliminaryRounds}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'until_one_undefeated' || value === 'until_two_undefeated') {
                  setPreliminaryRounds(value)
                } else {
                  setPreliminaryRounds(parseInt(value))
                }
              }}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              <option value="3">3回戦</option>
              <option value="4">4回戦</option>
              <option value="5">5回戦</option>
              <option value="6">6回戦</option>
              <option value="until_one_undefeated">全勝者1人以下になるまで</option>
              <option value="until_two_undefeated">全勝者2人以下になるまで</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            決勝トーナメント人数 *
            <select
              value={tournamentSize}
              onChange={(e) => setTournamentSize(parseInt(e.target.value) as 4 | 8 | 16 | 32)}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              <option value="4">4人</option>
              <option value="8">8人</option>
              <option value="16">16人</option>
              <option value="32">32人</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            エントリー開始日時
            <input
              type="datetime-local"
              value={entryStartAt}
              onChange={(e) => setEntryStartAt(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            エントリー終了日時
            <input
              type="datetime-local"
              value={entryEndAt}
              onChange={(e) => setEntryEndAt(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            定員数（空欄の場合は無制限）
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              min="1"
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            イベント開催日付
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            受付時間
            <input
              type="time"
              value={registrationTime}
              onChange={(e) => setRegistrationTime(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            大会開始時間
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" disabled={loading} style={{ padding: '10px 20px' }}>
            {loading ? '作成中...' : '作成'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{ padding: '10px 20px' }}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}

