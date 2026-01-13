import { prisma } from '../lib/prisma'

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
  // 同じ勝敗数の中からランダムに選ぶ方式
  const matches: any[] = []
  const used = new Set<string>()
  let matchNumber = 1
  let tableNumber = 1

  // 勝敗数でグループ化（wins-losses形式）
  const recordGroups = new Map<string, typeof participants>()
  for (const participant of participants) {
    const wins = participant.wins || 0
    const losses = participant.losses || 0
    const record = `${wins}-${losses}`
    if (!recordGroups.has(record)) {
      recordGroups.set(record, [])
    }
    recordGroups.get(record)!.push(participant)
  }

  // 勝敗数の降順でソート（2-0 > 1-1 > 0-2 など）
  const sortedRecords = Array.from(recordGroups.keys()).sort((a, b) => {
    const [winsA, lossesA] = a.split('-').map(Number)
    const [winsB, lossesB] = b.split('-').map(Number)
    const pointsA = winsA - lossesA
    const pointsB = winsB - lossesB
    if (pointsA !== pointsB) return pointsB - pointsA
    if (winsA !== winsB) return winsB - winsA
    return lossesA - lossesB
  })

  // 各勝敗数グループでマッチング
  for (let recordIdx = 0; recordIdx < sortedRecords.length; recordIdx++) {
    const record = sortedRecords[recordIdx]
    let group = recordGroups.get(record)!.filter(p => !used.has(p.id))
    
    // グループをシャッフル（ランダム化）
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]]
    }

    // 奇数人数の場合、次の勝敗数が高いグループに移動（下階段）
    if (group.length % 2 === 1 && recordIdx < sortedRecords.length - 1) {
      const nextRecord = sortedRecords[recordIdx + 1]
      const nextGroup = recordGroups.get(nextRecord)!.filter(p => !used.has(p.id))
      
      if (nextGroup.length > 0) {
        // 次のグループに移動（最初に対戦相手を選ぶ権利を持つ）
        const movedPlayer = group.pop()!
        nextGroup.unshift(movedPlayer) // 先頭に追加
        recordGroups.set(nextRecord, nextGroup)
        group = [] // 元のグループは空になる
      }
    }

    // 同じ勝敗数グループ内でランダムにマッチング
    while (group.length >= 2) {
      const player1 = group.shift()!
      if (used.has(player1.id)) continue

      // 既に対戦していない相手を探す
      const opponents1 = previousOpponents.get(player1.id) || new Set()
      let paired = false
      
      // 同じグループ内で既に対戦していない相手を探す
      for (let i = 0; i < group.length; i++) {
        const player2 = group[i]
        if (used.has(player2.id)) continue
        if (opponents1.has(player2.id)) continue

        // ペアリング
        const match = await prisma.match.create({
          data: {
            tournamentId,
            round,
            matchNumber: matchNumber++,
            player1Id: player1.id,
            player2Id: player2.id,
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
        used.add(player1.id)
        used.add(player2.id)
        group.splice(i, 1) // マッチした相手をグループから削除
        paired = true
        break
      }

      // 同じグループ内でペアが見つからなかった場合、次のグループを探す
      if (!paired) {
        let foundOpponent = false
        
        // 次の勝敗数グループを探す
        for (let nextIdx = recordIdx + 1; nextIdx < sortedRecords.length; nextIdx++) {
          const nextRecord = sortedRecords[nextIdx]
          const nextGroup = recordGroups.get(nextRecord)!.filter(p => !used.has(p.id))
          
          for (let j = 0; j < nextGroup.length; j++) {
            const opponent = nextGroup[j]
            if (opponents1.has(opponent.id)) continue

            // ペアリング
            const match = await prisma.match.create({
              data: {
                tournamentId,
                round,
                matchNumber: matchNumber++,
                player1Id: player1.id,
                player2Id: opponent.id,
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
            used.add(player1.id)
            used.add(opponent.id)
            nextGroup.splice(j, 1) // マッチした相手をグループから削除
            recordGroups.set(nextRecord, nextGroup)
            foundOpponent = true
            break
          }
          
          if (foundOpponent) break
        }

        // それでもペアが見つからなかった場合（奇数人数）
        if (!foundOpponent) {
          // バイ（不戦勝）として扱う
          await prisma.participant.update({
            where: { id: player1.id },
            data: {
              wins: { increment: 1 },
              points: { increment: 3 },
            },
          })
          used.add(player1.id)
        }
      }
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

  // 各参加者のOMWと平均OMWを計算（バッチ更新で最適化）
  const updatePromises = participants.map(async (participant) => {
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

    // 実際のマッチ結果からwins, losses, draws, pointsを再計算
    let wins = 0
    let losses = 0
    let draws = 0
    let points = 0

    for (const match of allMatches) {
      const result = match.result?.toUpperCase()
      if (result === 'PLAYER1') {
        wins++
        points += 3
      } else if (result === 'PLAYER2') {
        losses++
      } else if (result === 'DRAW') {
        draws++
        points += 1
      }
      // BOTH_LOSSの場合は何も加算しない
    }

    // OMW%計算（対戦相手のマッチ勝率の平均）
    // 各対戦相手のMW% = 対戦相手のマッチポイント / (対戦相手の総試合数 × 3)
    // MW%が33%未満の場合は33%に調整
    // OMW% = 全対戦相手のMW%の平均
    const opponentMWs: number[] = []
    const uniqueOpponents = new Map<string, any>()

    // 対戦相手を重複排除（同じ相手と複数回対戦した場合も1回として扱う）
    for (const match of allMatches) {
      const opponentId = match.opponent.id
      if (!uniqueOpponents.has(opponentId)) {
        uniqueOpponents.set(opponentId, match.opponent)
      }
    }

    // 各対戦相手のMW%を計算
    for (const opponent of Array.from(uniqueOpponents.values())) {
      const opponentMatchesCount = opponent.wins + opponent.losses + opponent.draws
      if (opponentMatchesCount > 0) {
        // 対戦相手のマッチポイント = wins × 3 + draws × 1
        const opponentMatchPoints = opponent.points || (opponent.wins * 3 + opponent.draws * 1)
        const maxPossiblePoints = opponentMatchesCount * 3
        let opponentMW = opponentMatchPoints / maxPossiblePoints
        
        // MW%が33%未満の場合は33%に調整
        if (opponentMW < 0.33) {
          opponentMW = 0.33
        }
        
        opponentMWs.push(opponentMW)
      }
    }

    // OMW% = 全対戦相手のMW%の平均
    const omw = opponentMWs.length > 0
      ? opponentMWs.reduce((a, b) => a + b, 0) / opponentMWs.length
      : 0

    // OOMW%（平均OMW%）は各対戦相手のMW%の平均（調整なし）
    const opponentMWsUnadjusted: number[] = []
    for (const opponent of Array.from(uniqueOpponents.values())) {
      const opponentMatchesCount = opponent.wins + opponent.losses + opponent.draws
      if (opponentMatchesCount > 0) {
        const opponentMatchPoints = opponent.points || (opponent.wins * 3 + opponent.draws * 1)
        const maxPossiblePoints = opponentMatchesCount * 3
        const opponentMW = opponentMatchPoints / maxPossiblePoints
        opponentMWsUnadjusted.push(opponentMW)
      }
    }

    const averageOmw = opponentMWsUnadjusted.length > 0
      ? opponentMWsUnadjusted.reduce((a, b) => a + b, 0) / opponentMWsUnadjusted.length
      : 0

    // 勝手累点（ゲームウィン）は現在の実装ではwinsと同じ
    const gameWins = participant.wins

    return prisma.participant.update({
      where: { id: participant.id },
      data: {
        omw,
        averageOmw,
        gameWins,
      },
    })
  })

  // バッチ更新を並列実行（接続プールの枯渇を防ぐため、一度に処理する数を制限）
  const batchSize = 5
  for (let i = 0; i < updatePromises.length; i += batchSize) {
    const batch = updatePromises.slice(i, i + batchSize)
    await Promise.all(batch)
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

  // 順位を更新（バッチ更新で最適化、接続プールの枯渇を防ぐため、一度に処理する数を制限）
  const rankUpdatePromises = updatedParticipants.map((participant, index) =>
    prisma.participant.update({
      where: { id: participant.id },
      data: {
        rank: index + 1,
      },
    })
  )

  const rankBatchSize = 5
  for (let i = 0; i < rankUpdatePromises.length; i += rankBatchSize) {
    const batch = rankUpdatePromises.slice(i, i + rankBatchSize)
    await Promise.all(batch)
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

