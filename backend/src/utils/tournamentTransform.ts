import { Tournament as PrismaTournament } from '@prisma/client'

export function transformTournament(tournament: PrismaTournament & { organizer?: any }) {
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

  return {
    ...tournament,
    status: tournament.status.toLowerCase() as 'draft' | 'registration' | 'in_progress' | 'completed',
    preliminaryRounds,
  }
}

export function transformMatch(match: any) {
  return {
    ...match,
    result: match.result ? match.result.toLowerCase() : null,
    player1: {
      ...match.player1,
      user: match.player1.user,
    },
    player2: {
      ...match.player2,
      user: match.player2.user,
    },
  }
}

