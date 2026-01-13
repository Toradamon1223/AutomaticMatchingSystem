import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTournament } from '../api/tournaments'
import BackButton from '../components/BackButton'
import VenueAutocomplete from '../components/VenueAutocomplete'
import { combineDateAndTime } from '../utils/dateUtils'

export default function CreateTournamentPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoImageUrl, setLogoImageUrl] = useState('')
  const [entryFee, setEntryFee] = useState('')
  const [preliminaryRounds, setPreliminaryRounds] = useState<
    number | 'until_one_undefeated' | 'until_two_undefeated'
  >(3)
  const [tournamentSize, setTournamentSize] = useState<4 | 8 | 16 | 32>(8)
  const [entryStartAt, setEntryStartAt] = useState('')
  const [entryEndAt, setEntryEndAt] = useState('')
  const [capacity, setCapacity] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [registrationTime, setRegistrationTime] = useState('')
  const [registrationEndTime, setRegistrationEndTime] = useState('')
  const [startTime, setStartTime] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [isPublic, setIsPublic] = useState(true)
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
      let registrationEndTimeValue: string | undefined = undefined
      let startTimeValue: string | undefined = undefined

      if (eventDate) {
        eventDateValue = eventDate
      }
      if (eventDate && registrationTime) {
        registrationTimeValue = combineDateAndTime(eventDate, registrationTime)
      }
      if (eventDate && registrationEndTime) {
        registrationEndTimeValue = combineDateAndTime(eventDate, registrationEndTime)
      }
      if (eventDate && startTime) {
        startTimeValue = combineDateAndTime(eventDate, startTime)
      }

      const tournament = await createTournament({
        name,
        description,
        logoImageUrl: logoImageUrl || undefined,
        entryFee: entryFee ? parseInt(entryFee) : undefined,
        preliminaryRounds,
        tournamentSize,
        entryStartAt: entryStartAt || undefined,
        entryEndAt: entryEndAt || undefined,
        capacity: capacity ? parseInt(capacity) : undefined,
        eventDate: eventDateValue,
        registrationTime: registrationTimeValue,
        registrationEndTime: registrationEndTimeValue,
        startTime: startTimeValue,
        venueName: venueName || undefined,
        venueAddress: venueAddress || undefined,
        isPublic,
      })
      navigate(`/tournaments/${tournament.id}/admin`)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || '大会の作成に失敗しました'
      const errorDetail = err.response?.data?.error
      console.error('Create tournament error:', err)
      console.error('Error details:', { errorMessage, errorDetail, response: err.response?.data })
      setError(errorMessage + (errorDetail ? ` (${errorDetail})` : ''))
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
            ロゴ画像URL
            <input
              type="url"
              value={logoImageUrl}
              onChange={(e) => setLogoImageUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            参加費（円）
            <input
              type="number"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              min="0"
              placeholder="例: 1000"
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
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
              onChange={(e) => {
                const newDate = e.target.value
                setEventDate(newDate)
                // 開催日を設定したら、時間の日付部分を自動設定
                if (newDate) {
                  if (!registrationTime) setRegistrationTime('09:00')
                  if (!registrationEndTime) setRegistrationEndTime('10:00')
                  if (!startTime) setStartTime('11:00')
                }
              }}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            受付開始時間
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
            受付終了時間
            <input
              type="time"
              value={registrationEndTime}
              onChange={(e) => setRegistrationEndTime(e.target.value)}
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

        <div style={{ marginBottom: '15px' }}>
          <VenueAutocomplete
            venueName={venueName}
            venueAddress={venueAddress}
            onVenueNameChange={setVenueName}
            onVenueAddressChange={setVenueAddress}
            apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <span>大会一覧に表示する</span>
          </label>
          <p style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>
            チェックを外すと、一般ユーザーの大会一覧に表示されません（管理者と主催者は常に見れます）
          </p>
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

