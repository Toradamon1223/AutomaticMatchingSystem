import apiClient from './client'
import { Tournament, Participant, Match, TournamentStanding } from '../types'

export const getTournaments = async (): Promise<Tournament[]> => {
  const response = await apiClient.get<Tournament[]>('/tournaments')
  return response.data
}

export interface MyParticipation {
  tournament: Tournament
  participant: {
    id: string
    enteredAt: string
    isWaitlist: boolean
    cancelledAt: string | null
    checkedIn: boolean
  }
}

export const getMyParticipations = async (): Promise<MyParticipation[]> => {
  const response = await apiClient.get<MyParticipation[]>('/tournaments/my-participations')
  return response.data
}

export const getTournament = async (id: string): Promise<Tournament> => {
  const response = await apiClient.get<Tournament>(`/tournaments/${id}`)
  return response.data
}

export const createTournament = async (data: {
  name: string
  description?: string
  logoImageUrl?: string
  entryFee?: number
  preliminaryRounds: number | 'until_one_undefeated' | 'until_two_undefeated'
  tournamentSize: 4 | 8 | 16 | 32
  entryStartAt?: string
  entryEndAt?: string
  capacity?: number
  eventDate?: string
  registrationTime?: string
  registrationEndTime?: string
  startTime?: string
  venueName?: string
  venueAddress?: string
  isPublic?: boolean
}): Promise<Tournament> => {
  const response = await apiClient.post<Tournament>('/tournaments', data)
  return response.data
}

export const updateTournament = async (
  tournamentId: string,
  data: {
    name?: string
    description?: string
    logoImageUrl?: string
    entryFee?: number
    venueName?: string
    venueAddress?: string
    eventDate?: string
    registrationTime?: string
    registrationEndTime?: string
    startTime?: string
    capacity?: number
    entryStartAt?: string
    entryEndAt?: string
    isPublic?: boolean
  }
): Promise<Tournament> => {
  const response = await apiClient.patch<Tournament>(`/tournaments/${tournamentId}`, data)
  return response.data
}

export interface EntryStatus {
  tournament: Tournament
  isEntryPeriod: boolean
  confirmedCount: number
  waitlistCount: number
  capacity: number | null
  myEntry: {
    id: string
    enteredAt: string
    isWaitlist: boolean
    cancelledAt: string | null
  } | null
}

export const getEntryStatus = async (tournamentId: string): Promise<EntryStatus> => {
  const response = await apiClient.get<EntryStatus>(`/tournaments/${tournamentId}/entry-status`)
  return response.data
}

export const enterTournament = async (tournamentId: string): Promise<{ participant: Participant; isWaitlist: boolean; message: string }> => {
  const response = await apiClient.post<{ participant: Participant; isWaitlist: boolean; message: string }>(
    `/tournaments/${tournamentId}/entry`
  )
  return response.data
}

export const cancelEntry = async (tournamentId: string): Promise<void> => {
  await apiClient.post(`/tournaments/${tournamentId}/entry/cancel`)
}

// 参加者を強制キャンセル（管理者または主催者のみ）
export const forceCancelParticipant = async (tournamentId: string, participantId: string): Promise<void> => {
  await apiClient.post(`/tournaments/${tournamentId}/participants/${participantId}/cancel`)
}

export const checkIn = async (tournamentId: string, qrCode: string): Promise<void> => {
  await apiClient.post(`/tournaments/${tournamentId}/checkin`, { qrCode })
}

export const getParticipants = async (tournamentId: string): Promise<Participant[]> => {
  const response = await apiClient.get<Participant[]>(`/tournaments/${tournamentId}/participants`)
  return response.data
}

export const getMatches = async (tournamentId: string, round?: number): Promise<Match[]> => {
  const params = round ? { round } : {}
  const response = await apiClient.get<Match[]>(`/tournaments/${tournamentId}/matches`, { params })
  return response.data
}

export const getMyMatch = async (tournamentId: string, round: number): Promise<Match | null> => {
  const response = await apiClient.get<Match | null>(
    `/tournaments/${tournamentId}/matches/my/${round}`
  )
  return response.data
}

export const reportMatchResult = async (
  tournamentId: string,
  matchId: string,
  result: 'player1' | 'player2' | 'draw' | 'both_loss'
): Promise<Match> => {
  const response = await apiClient.post<Match>(
    `/tournaments/${tournamentId}/matches/${matchId}/result`,
    { result }
  )
  return response.data
}

export const getStandings = async (tournamentId: string): Promise<TournamentStanding[]> => {
  const response = await apiClient.get<TournamentStanding[]>(
    `/tournaments/${tournamentId}/standings`
  )
  return response.data
}

// 管理者用API
export const startTournament = async (
  tournamentId: string,
  preliminaryRounds: number | 'until_one_undefeated' | 'until_two_undefeated',
  maxRounds?: number
): Promise<Tournament> => {
  const response = await apiClient.post<Tournament>(`/tournaments/${tournamentId}/start`, {
    preliminaryRounds,
    maxRounds,
  })
  return response.data
}

export const generatePairings = async (tournamentId: string, round: number): Promise<Match[]> => {
  const response = await apiClient.post<Match[]>(
    `/tournaments/${tournamentId}/rounds/${round}/pairings`
  )
  return response.data
}

export const checkRoundCompleted = async (
  tournamentId: string,
  round: number
): Promise<{ completed: boolean; totalMatches: number; completedMatches: number }> => {
  const response = await apiClient.get<{ completed: boolean; totalMatches: number; completedMatches: number }>(
    `/tournaments/${tournamentId}/rounds/${round}/completed`
  )
  return response.data
}

export const createNextRound = async (tournamentId: string): Promise<{ round: number; matches: Match[] }> => {
  const response = await apiClient.post<{ round: number; matches: Match[] }>(
    `/tournaments/${tournamentId}/next-round`
  )
  return response.data
}

export const startRound = async (tournamentId: string, round: number): Promise<{ message: string; matchesUpdated: number }> => {
  const response = await apiClient.post<{ message: string; matchesUpdated: number }>(
    `/tournaments/${tournamentId}/rounds/${round}/start`
  )
  return response.data
}

export const updateMatchPoints = async (
  tournamentId: string,
  matchId: string,
  player1Points: number,
  player2Points: number
): Promise<Match> => {
  const response = await apiClient.patch<Match>(
    `/tournaments/${tournamentId}/matches/${matchId}/points`,
    { player1Points, player2Points }
  )
  return response.data
}

export const dropParticipant = async (tournamentId: string, participantId: string): Promise<void> => {
  await apiClient.post(`/tournaments/${tournamentId}/participants/${participantId}/drop`)
}

// 参加者のチェックイン/チェックアウト（管理者または主催者のみ）
export const toggleParticipantCheckIn = async (tournamentId: string, participantId: string): Promise<Participant> => {
  const response = await apiClient.post<Participant>(`/tournaments/${tournamentId}/participants/${participantId}/checkin`)
  return response.data
}

// ゲストユーザーを追加（管理者または主催者のみ）
export const addGuestParticipant = async (tournamentId: string, playerName: string): Promise<Participant> => {
  const response = await apiClient.post<Participant>(`/tournaments/${tournamentId}/participants/guest`, { playerName })
  return response.data
}

export const rematchRound = async (tournamentId: string, round: number): Promise<{ round: number; matches: Match[] }> => {
  const response = await apiClient.post<{ round: number; matches: Match[] }>(
    `/tournaments/${tournamentId}/rounds/${round}/rematch`
  )
  return response.data
}

// 対戦開始（対戦表を参加者に公開）
export const startMatches = async (tournamentId: string): Promise<Tournament> => {
  const response = await apiClient.post<Tournament>(`/tournaments/${tournamentId}/start-matches`)
  return response.data
}

// 第1回戦の対戦表を再作成
export const rematchRound1 = async (tournamentId: string): Promise<Match[]> => {
  const response = await apiClient.post<Match[]>(`/tournaments/${tournamentId}/rematch-round1`)
  return response.data
}

// アナウンス取得
export const getAnnouncement = async (tournamentId: string): Promise<{ announcement: string }> => {
  const response = await apiClient.get<{ announcement: string }>(`/tournaments/${tournamentId}/announcement`)
  return response.data
}

// アナウンス更新（主催者/管理者のみ）
export const updateAnnouncement = async (tournamentId: string, announcement: string): Promise<{ announcement: string }> => {
  const response = await apiClient.patch<{ announcement: string }>(`/tournaments/${tournamentId}/announcement`, { announcement })
  return response.data
}

// トーナメントリセット（1回戦開始前に戻す、主催者/管理者のみ）
export const resetTournament = async (tournamentId: string): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>(`/tournaments/${tournamentId}/reset`)
  return response.data
}

