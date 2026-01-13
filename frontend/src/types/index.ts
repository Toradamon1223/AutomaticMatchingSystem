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
  logoImageUrl?: string
  entryFee?: number
  organizerId: string
  participantCount?: number
  organizer: User
  status: 'draft' | 'registration' | 'preparing' | 'in_progress' | 'completed'
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
  registrationEndTime?: string
  startTime?: string
  venueName?: string
  venueAddress?: string
  announcement?: string
  isPublic?: boolean // 大会一覧に表示するかどうか
  matchesVisible?: boolean // 対戦表を参加者に公開するかどうか
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
  createdAt?: string // データベースに作成された時刻（同じenteredAtの場合のソート用）
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
  pointsBeforeRound?: number // その回戦以前の勝ち点
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
  result?: 'player1' | 'player2' | 'draw' | 'both_loss'
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

