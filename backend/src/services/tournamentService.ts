import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// スイスドロー形式のマッチング生成
export async function generatePairings(tournamentId: string, round: number): Promise<any[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: {
          checkedIn: true,
          dropped: false,
          cancelledAt: null, // キャンセルされていない参加者のみ
        },
        include: {
          user: true,
        },
      },
    },
  })

  if (!tournament) {
    throw new Error('大会が見つかりません')
  }

  // 順位を計算
  await calculateStandings(tournamentId)

  // 順位順にソート
  const participants = await prisma.participant.findMany({
    where: {
      tournamentId,
      checkedIn: true,
      dropped: false,
      cancelledAt: null, // キャンセルされていない参加者のみ
    },
    include: {
      user: true,
    },
    orderBy: [
      { rank: 'asc' },
      { points: 'desc' },
      { omw: 'desc' },
      { gameWins: 'desc' },
      { averageOmw: 'desc' },
    ],
  })

  if (participants.length < 2) {
    throw new Error('参加者が2名未満です')
  }

  // 既に対戦した相手を記録
  const previousOpponents = new Map<string, Set<string>>()
  const previousMatches = await prisma.match.findMany({
    where: {
      tournamentId,
      round: { lt: round },
    },
  })

  previousMatches.forEach((match) => {
    if (!previousOpponents.has(match.player1Id)) {
      previousOpponents.set(match.player1Id, new Set())
    }
    if (!previousOpponents.has(match.player2Id)) {
      previousOpponents.set(match.player2Id, new Set())
    }
    previousOpponents.get(match.player1Id)!.add(match.player2Id)
    previousOpponents.get(match.player2Id)!.add(match.player1Id)
  })

  // マッチング生成（ペアリングアルゴリズム）
  const matches: any[] = []
  const used = new Set<string>()
  let matchNumber = 1
  let tableNumber = 1

  for (let i = 0; i < participants.length; i++) {
    if (used.has(participants[i].id)) continue

    let paired = false
    for (let j = i + 1; j < participants.length; j++) {
      if (used.has(participants[j].id)) continue

      // 既に対戦していないか確認
      const opponents1 = previousOpponents.get(participants[i].id) || new Set()
      if (opponents1.has(participants[j].id)) continue

      // ペアリング
      const match = await prisma.match.create({
        data: {
          tournamentId,
          round,
          matchNumber: matchNumber++,
          player1Id: participants[i].id,
          player2Id: participants[j].id,
          tableNumber: tableNumber++,
          isTournamentMatch: false,
        },
        include: {
          player1: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          player2: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      matches.push(match)
      used.add(participants[i].id)
      used.add(participants[j].id)
      paired = true
      break
    }

    // ペアが見つからなかった場合（奇数人数）
    if (!paired && !used.has(participants[i].id)) {
      // バイ（不戦勝）として扱う
      // バイの場合は自動的に勝ち点が加算される
      await prisma.participant.update({
        where: { id: participants[i].id },
        data: {
          wins: { increment: 1 },
          points: { increment: 3 },
        },
      })
    }
  }

  // 現在の回戦数を更新
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      currentRound: round,
      maxRounds: Math.max(tournament.maxRounds, round),
    },
  })

  return matches
}

// オポネント方式による順位計算
export async function calculateStandings(tournamentId: string): Promise<void> {
  const participants = await prisma.participant.findMany({
    where: {
      tournamentId,
      checkedIn: true,
      dropped: false,
      cancelledAt: null, // キャンセルされていない参加者のみ
    },
    include: {
      matchesAsPlayer1: {
        where: {
          tournamentId,
          result: { not: null },
        },
        include: {
          player2: true,
        },
      },
      matchesAsPlayer2: {
        where: {
          tournamentId,
          result: { not: null },
        },
        include: {
          player1: true,
        },
      },
    },
  })

  // 各参加者のOMWと平均OMWを計算
  for (const participant of participants) {
    const allMatches = [
      ...participant.matchesAsPlayer1.map((m) => ({
        opponent: m.player2,
        result: m.result,
      })),
      ...participant.matchesAsPlayer2.map((m) => ({
        opponent: m.player1,
        result: m.result === 'PLAYER1' ? 'PLAYER2' : m.result === 'PLAYER2' ? 'PLAYER1' : 'DRAW',
      })),
    ]

    // OMW%計算（対戦相手の勝率）
    let totalOpponentWins = 0
    let totalOpponentMatches = 0
    const opponentWins: number[] = []

    for (const match of allMatches) {
      const opponentWinsCount = match.opponent.wins
      const opponentMatchesCount = match.opponent.wins + match.opponent.losses + match.opponent.draws
      
      if (opponentMatchesCount > 0) {
        totalOpponentWins += opponentWinsCount
        totalOpponentMatches += opponentMatchesCount
        opponentWins.push(opponentWinsCount / opponentMatchesCount)
      }
    }

    const omw = totalOpponentMatches > 0 ? totalOpponentWins / totalOpponentMatches : 0
    const averageOmw = opponentWins.length > 0
      ? opponentWins.reduce((a, b) => a + b, 0) / opponentWins.length
      : 0

    // 勝手累点（ゲームウィン）は現在の実装ではwinsと同じ
    const gameWins = participant.wins

    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        omw,
        averageOmw,
        gameWins,
      },
    })
  }

  // 順位を計算（オポネント方式）
  const updatedParticipants = await prisma.participant.findMany({
    where: {
      tournamentId,
      checkedIn: true,
      dropped: false,
      cancelledAt: null, // キャンセルされていない参加者のみ
    },
  })

  // 順位付け
  updatedParticipants.sort((a, b) => {
    // 1. 累計得点
    if (a.points !== b.points) {
      return b.points - a.points
    }
    // 2. OMW%
    if (a.omw !== b.omw) {
      return b.omw - a.omw
    }
    // 3. 勝手累点
    if (a.gameWins !== b.gameWins) {
      return b.gameWins - a.gameWins
    }
    // 4. 平均OMW%
    return b.averageOmw - a.averageOmw
  })

  // 順位を更新
  for (let i = 0; i < updatedParticipants.length; i++) {
    await prisma.participant.update({
      where: { id: updatedParticipants[i].id },
      data: {
        rank: i + 1,
      },
    })
  }
}

// トーナメントマッチング生成（決勝トーナメント）
export async function generateTournamentPairings(
  tournamentId: string,
  topN: number
): Promise<any[]> {
  const participants = await prisma.participant.findMany({
    where: {
      tournamentId,
      checkedIn: true,
      dropped: false,
      cancelledAt: null, // キャンセルされていない参加者のみ
    },
    include: {
      user: true,
    },
    orderBy: [
      { rank: 'asc' },
    ],
    take: topN,
  })

  if (participants.length !== topN) {
    throw new Error(`上位${topN}名の参加者が揃っていません`)
  }

  // トーナメント形式のマッチング（1位 vs 8位, 2位 vs 7位 など）
  const matches: any[] = []
  let matchNumber = 1
  let round = 1 // トーナメント1回戦

  for (let i = 0; i < topN / 2; i++) {
    const player1 = participants[i]
    const player2 = participants[topN - 1 - i]

    const match = await prisma.match.create({
      data: {
        tournamentId,
        round,
        matchNumber: matchNumber++,
        player1Id: player1.id,
        player2Id: player2.id,
        tableNumber: matchNumber,
        isTournamentMatch: true,
      },
      include: {
        player1: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        player2: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    matches.push(match)
  }

  return matches
}

