import { useEffect, useState } from 'react'
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
  startMatches,
  rematchRound1,
  reportMatchResult,
  getStandings,
  createNextRound,
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
  }, [id])

  // タブ変更時にデータを読み込む
  useEffect(() => {
    if (id && activeTab === 'tournament') {
      loadMatches(selectedRound)
      loadStandings()
    }
  }, [id, activeTab, selectedRound])

  // 対戦表画面で定期的にデータを更新（5秒ごと）
  useEffect(() => {
    if (id && activeTab === 'tournament' && tournament?.status === 'in_progress') {
      const interval = setInterval(() => {
        loadMatches(selectedRound)
        loadStandings()
      }, 5000) // 5秒ごとに更新

      return () => clearInterval(interval)
    }
  }, [id, activeTab, selectedRound, tournament?.status])

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
      setMatches(data)
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
            <div style={{ marginBottom: '20px', textAlign: 'right' }}>
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
            </div>
          )}
          {tournament.status === 'in_progress' ? (
            <div style={{ width: '100%' }}>
              {/* 管理ボタン */}
              {canEditTournament && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '20px' }}>
                  {!(tournament as any).matchesVisible && (
                    <button
                      onClick={async () => {
                        if (!id) return
                        if (!confirm('対戦表を参加者に公開しますか？')) return
                        try {
                          await startMatches(id)
                          alert('対戦表を公開しました')
                          await loadTournament()
                          await loadMatches(selectedRound)
                        } catch (error: any) {
                          alert(error.response?.data?.message || '対戦開始に失敗しました')
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      対戦開始
                    </button>
                  )}
                  {matches.length > 0 && selectedRound === 1 && (
                    <button
                      onClick={async () => {
                        if (!id) return
                        if (!confirm('第1回戦の対戦表を再作成しますか？既存の対戦表は削除されます。')) return
                        try {
                          await rematchRound1(id)
                          alert('対戦表を再作成しました')
                          await loadMatches(selectedRound)
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
                    const completedCount = currentRoundMatches.filter(m => m.result).length
                    const totalCount = currentRoundMatches.length

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
                            const roundMatches = matches.filter(m => m.round === round)
                            const roundCompleted = roundMatches.filter(m => m.result).length
                            const roundTotal = roundMatches.length
                            const isCurrentRound = round === selectedRound
                            const isActiveRound = round === tournament.currentRound
                            const isPastRound = round < (tournament.currentRound || 0)

                            return (
                              <button
                                key={round}
                                onClick={() => {
                                  setSelectedRound(round)
                                  loadMatches(round)
                                }}
                                style={{
                                  padding: isMobile ? '8px 16px' : '10px 20px',
                                  backgroundColor: isCurrentRound 
                                    ? (isActiveRound ? '#4CAF50' : (isDark ? '#333' : '#2196F3'))
                                    : (isActiveRound ? (isDark ? '#1a3a1a' : '#e8f5e9') : 'transparent'),
                                  color: isCurrentRound 
                                    ? 'white'
                                    : (isActiveRound 
                                        ? (isDark ? '#4CAF50' : '#2e7d32')
                                        : (isPastRound 
                                            ? (isDark ? '#888' : '#999')
                                            : (isDark ? '#fff' : '#333'))),
                                  border: `2px solid ${
                                    isCurrentRound 
                                      ? (isActiveRound ? '#4CAF50' : '#2196F3')
                                      : (isActiveRound 
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
                                  {isActiveRound && (
                                    <div style={{ 
                                      fontSize: '9px',
                                      marginTop: '2px',
                                      opacity: 0.8,
                                    }}>
                                      実施中
                                    </div>
                                  )}
                                  {isPastRound && roundTotal > 0 && roundCompleted === roundTotal && (
                                    <div style={{ 
                                      fontSize: '9px',
                                      marginTop: '2px',
                                      opacity: 0.7,
                                    }}>
                                      完了
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        {/* 全試合終了後の次の対戦表作成ボタン */}
                        {canEditTournament && 
                         currentRoundMatches.length > 0 && 
                         completedCount === totalCount && 
                         tournament.currentRound && 
                         tournament.maxRounds && 
                         tournament.currentRound < tournament.maxRounds && (
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
                                  await loadMatches(result.round)
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

                        {/* 対戦表表示 */}
                        {currentRoundMatches.length === 0 ? (
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
                                  : 'repeat(auto-fill, minmax(160px, 1fr))',
                                gap: isMobile ? '10px' : '12px',
                                padding: isMobile ? '10px 0' : '20px 0',
                              }}
                            >
                              {currentRoundMatches
                                .sort((a, b) => (a.tableNumber || 0) - (b.tableNumber || 0))
                                .map((match) => {
                                  const isMyMatch = match.player1.user.id === user?.id || match.player2.user.id === user?.id
                                  const canTap = isMyMatch || canEditTournament
                                  const player1Win = match.result === 'player1'
                                  const player2Win = match.result === 'player2'
                                  const isDraw = match.result === 'draw'
                                  const isBothLoss = (match.result as string) === 'both_loss'
                                  
                                  // スコア計算
                                  const player1Score = player1Win ? 1 : (isDraw ? 1 : (isBothLoss ? 0 : 0))
                                  const player2Score = player2Win ? 1 : (isDraw ? 1 : (isBothLoss ? 0 : 0))
                                  
                                  // スコアボックスの色
                                  const getScoreColor = (score: number, hasResult: boolean) => {
                                    if (!hasResult) return isDark ? '#666' : '#999'
                                    if (score === 1) return '#2196F3' // 青（勝利/引き分け）
                                    return isDark ? '#666' : '#999' // グレー（敗北/未登録）
                                  }

                                  return (
                                    <div
                                      key={match.id}
                                      style={{
                                        position: 'relative',
                                        padding: isMobile ? '10px' : '12px',
                                        border: `1px solid ${isMyMatch ? (isDark ? '#4CAF50' : '#4CAF50') : (isDark ? '#444' : '#ddd')}`,
                                        borderRadius: '8px',
                                        backgroundColor: isMyMatch 
                                          ? (isDark ? '#1a3a1a' : '#e8f5e9') 
                                          : (isDark ? '#1a1a1a' : '#fff'),
                                        color: isDark ? '#fff' : '#333',
                                        cursor: canTap ? 'pointer' : 'default',
                                        transition: 'all 0.2s',
                                        boxShadow: isMyMatch ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                      }}
                                      onClick={() => {
                                        if (canTap) {
                                          setSelectedMatch(match)
                                          setShowResultDialog(true)
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
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          minWidth: 0,
                                        }}>
                                          {match.player1.user.name}
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
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          minWidth: 0,
                                        }}>
                                          {match.player2.user.name}
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
                            .map((standing, index) => (
                              <tr
                                key={standing.participant.id}
                                style={{
                                  borderBottom: `1px solid ${isDark ? '#333' : '#ddd'}`,
                                }}
                              >
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{index + 1}</td>
                                <td style={{ padding: '12px' }}>{standing.participant.user.name}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  {standing.participant.wins}-{standing.participant.losses}-{standing.participant.draws}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{standing.points}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  {standing.omw ? (standing.omw * 100).toFixed(2) : '0.00'}%
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>{standing.gameWins || standing.participant.wins}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  {standing.averageOmw ? (standing.averageOmw * 100).toFixed(2) : '0.00'}%
                                </td>
                              </tr>
                            ))}
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
                            await loadMatches(selectedRound)
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
                            await loadMatches(selectedRound)
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
                            await loadMatches(selectedRound)
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
                              await loadMatches(selectedRound)
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
