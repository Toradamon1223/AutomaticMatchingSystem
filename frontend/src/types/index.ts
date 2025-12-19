export type UserRole = 'user' | 'organizer' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  createdAt: string
}

export interface Tournament {
  id: string
  name: string
  description?: string
  organizerId: string
  organizer: User
  status: 'draft' | 'registration' | 'in_progress' | 'completed'
  checkInQrCode: string
  preliminaryRounds: number | 'until_one_undefeated' | 'until_two_undefeated'
  tournamentSize: 4 | 8 | 16 | 32
  currentRound: number
  maxRounds: number
  entryStartAt?: string
  entryEndAt?: string
  capacity?: number
  eventDate?: string
  registrationTime?: string
  startTime?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface Participant {
  id: string
  tournamentId: string
  userId: string
  user: User
  enteredAt: string
  isWaitlist: boolean
  cancelledAt?: string
  checkedIn: boolean
  checkedInAt?: string
  dropped: boolean
  droppedAt?: string
  // 予選成績
  wins: number
  losses: number
  draws: number
  points: number // 累計得点
  omw: number // OMW%
  gameWins: number // 勝手累点
  averageOmw: number // 平均OMW%
  rank: number
  // トーナメント成績
  tournamentWins: number
  tournamentLosses: number
  tournamentEliminated: boolean
}

export interface Match {
  id: string
  tournamentId: string
  round: number
  matchNumber: number
  player1Id: string
  player1: Participant
  player2Id: string
  player2: Participant
  tableNumber?: number
  result?: 'player1' | 'player2' | 'draw'
  reportedBy?: string
  reportedAt?: string
  isTournamentMatch: boolean
  createdAt: string
}

export interface TournamentStanding {
  participant: Participant
  rank: number
  points: number
  omw: number
  gameWins: number
  averageOmw: number
}

