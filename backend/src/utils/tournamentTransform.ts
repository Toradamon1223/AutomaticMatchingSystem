import { Tournament as PrismaTournament } from '@prisma/client'

export function transformTournament(tournament: PrismaTournament & { organizer?: any; participants?: any[] }) {
  let preliminaryRounds: number | 'until_one_undefeated' | 'until_two_undefeated'
  try {
    const parsed = JSON.parse(tournament.preliminaryRounds)
    if (typeof parsed === 'number') {
      preliminaryRounds = parsed
    } else if (parsed === 'until_one_undefeated' || parsed === 'until_two_undefeated') {
      preliminaryRounds = parsed
    } else {
      preliminaryRounds = parsed
    }
  } catch {
    preliminaryRounds = tournament.preliminaryRounds as any
  }

  // participantsを除外して返す（必要に応じて別途取得）
  const tournamentObj = tournament as any
  const { participants, matches, ...tournamentWithoutRelations } = tournamentObj

  return {
    ...tournamentWithoutRelations,
    status: tournament.status.toLowerCase() as 'draft' | 'registration' | 'preparing' | 'in_progress' | 'completed',
    preliminaryRounds,
  }
}

export function transformMatch(match: any, pointsBeforeRound?: { player1Points: number; player2Points: number }) {
  // バイの試合（player1Id === player2Id）の場合、player2の名前を"BYE"として表示
  const isBye = match.player1Id === match.player2Id
  
  return {
    ...match,
    result: match.result ? match.result.toLowerCase() : null,
    player1: {
      ...match.player1,
      user: match.player1.user,
      pointsBeforeRound: pointsBeforeRound?.player1Points,
    },
    player2: {
      ...match.player2,
      user: isBye ? { ...match.player2.user, name: 'BYE' } : match.player2.user,
      pointsBeforeRound: isBye ? undefined : pointsBeforeRound?.player2Points,
    },
  }
}

