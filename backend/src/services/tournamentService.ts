import { prisma } from '../lib/prisma'

// スイスドロー形式のマッチング生成
export async function generatePairings(tournamentId: string, round: number): Promise<any[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        where: {
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

  // 順位を計算（チェックイン済みの参加者のみ）
  await calculateStandings(tournamentId)

  // 第1回戦はチェックイン済みの参加者のみ
  // 第2回戦以降は、前の回戦で実際に対戦した参加者を含める
  // （チェックイン状態は1回戦の時点で設定され、その後は変わらない）
  let participantFilter: any = {
    tournamentId,
    dropped: false,
    cancelledAt: null,
  }

  if (round === 1) {
    // 第1回戦はチェックイン済みの参加者のみ
    participantFilter.checkedIn = true
  } else {
    // 第2回戦以降は、前の回戦で対戦した参加者を含める
    // 前の回戦のマッチに参加している参加者IDを取得
    // プレビューマッチ（isTournamentMatch: false）も含める
    // なぜなら、1回戦がまだ「開始」されていない場合でも、対戦表は作成されているから
    const previousMatches = await prisma.match.findMany({
      where: {
        tournamentId,
        round: round - 1,
        // isTournamentMatchの条件を削除：プレビューマッチも含める
      },
      select: {
        player1Id: true,
        player2Id: true,
      },
    })

    console.log(`[generatePairings] Round ${round}: Found ${previousMatches.length} matches from round ${round - 1}`)

    const previousRoundParticipantIds = new Set<string>()
    previousMatches.forEach(match => {
      // BYEマッチ（player1Id === player2Id）も含める
      previousRoundParticipantIds.add(match.player1Id)
      if (match.player1Id !== match.player2Id) {
        previousRoundParticipantIds.add(match.player2Id)
      }
    })

    console.log(`[generatePairings] Round ${round}: Found ${previousRoundParticipantIds.size} unique participants from round ${round - 1}`)
    console.log(`[generatePairings] Round ${round}: Participant IDs:`, Array.from(previousRoundParticipantIds).slice(0, 10), '...')

    if (previousRoundParticipantIds.size === 0) {
      throw new Error('前の回戦の対戦データが見つかりません')
    }

    // 前の回戦に参加した参加者のみを含める
    participantFilter.id = {
      in: Array.from(previousRoundParticipantIds),
    }
  }

  // 順位順にソート
  const participants = await prisma.participant.findMany({
    where: participantFilter,
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

  console.log(`[generatePairings] Round ${round}: Filtered to ${participants.length} participants`)

  if (participants.length < 2) {
    throw new Error('参加者が2名未満です')
  }

  // 既に対戦した相手を記録
  // プレビューマッチも含める（再マッチ防止のため）
  const previousOpponents = new Map<string, Set<string>>()
  const previousMatches = await prisma.match.findMany({
    where: {
      tournamentId,
      round: { lt: round },
      // isTournamentMatchの条件を削除：プレビューマッチも含める
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
  const movedFromHigherGroup = new Set<string>() // 下グループから移動してきたプレーヤーを追跡
  let matchNumber = 1
  let tableNumber = 1

  // 勝ち点でグループ化
  const recordGroups = new Map<number, typeof participants>()
  for (const participant of participants) {
    const points = participant.points || 0
    const record = Math.floor(points) // 勝ち点を整数に変換（小数点以下を切り捨て）
    if (!recordGroups.has(record)) {
      recordGroups.set(record, [])
    }
    recordGroups.get(record)!.push(participant)
  }

  // デバッグ: 各グループの人数をログ出力
  console.log(`[generatePairings] Round ${round}: Point groups:`)
  for (const [points, group] of Array.from(recordGroups.entries()).sort((a, b) => b[0] - a[0])) {
    console.log(`  ${points} points: ${group.length} participants`)
    // 各グループの最初の数人の参加者IDとポイントをログ出力
    const sampleParticipants = group.slice(0, 3).map(p => ({
      id: p.id.substring(0, 8),
      name: p.user.name,
      wins: p.wins,
      losses: p.losses,
      points: p.points
    }))
    console.log(`    Sample:`, sampleParticipants)
  }

  // 勝ち点の降順でソート
  const sortedRecords = Array.from(recordGroups.keys()).sort((a, b) => b - a)

  console.log(`[generatePairings] Round ${round}: Sorted records:`, sortedRecords)

  // 各勝ち点グループでマッチング
  for (let recordIdx = 0; recordIdx < sortedRecords.length; recordIdx++) {
    const record = sortedRecords[recordIdx]
    let group = recordGroups.get(record)!.filter(p => !used.has(p.id))
    
    console.log(`[generatePairings] Round ${round}: Processing ${record} points group, ${group.length} participants (after filtering used)`)
    
    // 下グループから移動してきたプレーヤーを先頭に固定
    // 移動してきたプレーヤーはplayer1側になるべきなので、シャッフルから除外
    const movedPlayers: typeof participants = []
    const regularPlayers: typeof participants = []
    
    for (const player of group) {
      if (movedFromHigherGroup.has(player.id)) {
        movedPlayers.push(player)
      } else {
        regularPlayers.push(player)
      }
    }
    
    // 通常のプレーヤーをシャッフル（ランダム化）
    for (let i = regularPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [regularPlayers[i], regularPlayers[j]] = [regularPlayers[j], regularPlayers[i]]
    }
    
    // 移動してきたプレーヤーを先頭に配置
    group = [...movedPlayers, ...regularPlayers]

    // 奇数人数の場合、次の勝ち点が低いグループに移動（下階段）
    if (group.length % 2 === 1 && recordIdx < sortedRecords.length - 1) {
      const nextRecord = sortedRecords[recordIdx + 1]
      const nextGroup = recordGroups.get(nextRecord)!.filter(p => !used.has(p.id))
      
      if (nextGroup.length > 0) {
        // 次のグループに移動（最初に対戦相手を選ぶ権利を持つ）
        const movedPlayer = group.pop()!
        nextGroup.unshift(movedPlayer) // 先頭に追加
        movedFromHigherGroup.add(movedPlayer.id) // 移動してきたプレーヤーを記録
        recordGroups.set(nextRecord, nextGroup)
        // groupは空にならない（残りの偶数人数でマッチングを続ける）
        console.log(`[generatePairings] Round ${round}: ${record} points group - Moved 1 player to ${nextRecord} points group, ${group.length} participants remaining`)
      }
    }

    // 同じ勝ち点グループ内でランダムにマッチング
    let matchesInThisGroup = 0
    while (group.length >= 2) {
      const player1 = group.shift()!
      if (used.has(player1.id)) {
        console.log(`[generatePairings] Round ${round}: ${record} points group - Player ${player1.id} already used, skipping`)
        continue
      }

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
        matchesInThisGroup++
        console.log(`[generatePairings] Round ${round}: ${record} points group - Paired ${player1.id} with ${player2.id}`)
        break
      }

      // 同じグループ内でペアが見つからなかった場合、次のグループを探す
      if (!paired) {
        let foundOpponent = false
        
        // 次の勝ち点グループを探す
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
            matchesInThisGroup++
            console.log(`[generatePairings] Round ${round}: ${record} points group - Paired ${player1.id} with ${opponent.id} from ${nextRecord} points group`)
            break
          }
          
          if (foundOpponent) break
        }

        // それでもペアが見つからなかった場合（奇数人数）
        if (!foundOpponent) {
          console.log(`[generatePairings] Round ${round}: ${record} points group - No opponent found for ${player1.id}, creating BYE match`)
          // バイ（不戦勝）として扱う
          // バイの場合は、player2Idに自分自身を設定し、player2の名前を"BYE"として表示する
          // マッチレコードを作成して、試合数を正しくカウントできるようにする
          const byeMatch = await prisma.match.create({
            data: {
              tournamentId,
              round,
              matchNumber: matchNumber++,
              player1Id: player1.id,
              player2Id: player1.id, // バイの場合は自分自身を設定（特別な値として扱う）
              tableNumber: tableNumber++,
              isTournamentMatch: false,
              result: 'PLAYER1', // バイを受けたプレイヤーの勝利として自動設定
              reportedBy: null, // 自動登録なのでreportedByはnull
              reportedAt: new Date(), // 自動登録の時刻
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
          
          matches.push(byeMatch)
          
          // 参加者の成績を更新（自動的に勝利として登録）
          await prisma.participant.update({
            where: { id: player1.id },
            data: {
              wins: { increment: 1 },
              points: { increment: 3 },
            },
          })
          used.add(player1.id)
          matchesInThisGroup++
        } else {
          // pairedがfalseで、foundOpponentがtrueの場合、player1は既にusedに追加されている
          // しかし、pairedがfalseのままなので、ここで確認
          if (!used.has(player1.id)) {
            console.error(`[generatePairings] Round ${round}: ${record} points group - Player ${player1.id} was not added to used set after pairing!`)
            used.add(player1.id)
          }
        }
      }
    }
    
    console.log(`[generatePairings] Round ${round}: ${record} points group - Created ${matchesInThisGroup} matches, ${group.length} participants remaining`)

    // グループが奇数人数で残った場合、最後の1人をBYEとして処理
    if (group.length === 1) {
      const remainingPlayer = group[0]
      if (!used.has(remainingPlayer.id)) {
        const byeMatch = await prisma.match.create({
          data: {
            tournamentId,
            round,
            matchNumber: matchNumber++,
            player1Id: remainingPlayer.id,
            player2Id: remainingPlayer.id,
            tableNumber: tableNumber++,
            isTournamentMatch: false,
            result: 'PLAYER1',
            reportedBy: null,
            reportedAt: new Date(),
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
        
        matches.push(byeMatch)
        
        await prisma.participant.update({
          where: { id: remainingPlayer.id },
          data: {
            wins: { increment: 1 },
            points: { increment: 3 },
          },
        })
        used.add(remainingPlayer.id)
      }
    }
  }

  // 全参加者がマッチに含まれているか確認
  const allParticipantIds = new Set(participants.map(p => p.id))
  const matchedParticipantIds = new Set(used)
  const unmatchedParticipants = Array.from(allParticipantIds).filter(id => !matchedParticipantIds.has(id))
  
  console.log(`[generatePairings] Round ${round}: Total participants: ${allParticipantIds.size}, Matched: ${matchedParticipantIds.size}, Unmatched: ${unmatchedParticipants.length}`)
  
  if (unmatchedParticipants.length > 0) {
    console.error(`[generatePairings] Round ${round}: ${unmatchedParticipants.length} participants were not matched:`, unmatchedParticipants.slice(0, 10))
    // マッチされていない参加者をBYEとして処理
    for (const participantId of unmatchedParticipants) {
      const participant = participants.find(p => p.id === participantId)
      if (!participant) continue
      
      const byeMatch = await prisma.match.create({
        data: {
          tournamentId,
          round,
          matchNumber: matchNumber++,
          player1Id: participant.id,
          player2Id: participant.id,
          tableNumber: tableNumber++,
          isTournamentMatch: false,
          result: 'PLAYER1',
          reportedBy: null,
          reportedAt: new Date(),
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
      
      matches.push(byeMatch)
      
      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          wins: { increment: 1 },
          points: { increment: 3 },
        },
      })
    }
  }

  console.log(`[generatePairings] Round ${round}: Created ${matches.length} matches for ${used.size + unmatchedParticipants.length} participants`)

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
  // 第1回戦以降は、前の回戦に参加した参加者の順位を計算する
  // チェックイン状態に関わらず、実際に対戦した参加者の順位を計算
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  })

  if (!tournament) {
    throw new Error('大会が見つかりません')
  }

  // 第1回戦以降の場合、前の回戦に参加した参加者のみを対象にする
  let participantFilter: any = {
    tournamentId,
    dropped: false,
    cancelledAt: null,
  }

  if (tournament.currentRound && tournament.currentRound > 0) {
    // 前の回戦に参加した参加者IDを取得
    const previousMatches = await prisma.match.findMany({
      where: {
        tournamentId,
        round: tournament.currentRound,
        // プレビューマッチも含める（結果が登録されていれば順位計算に含める）
      },
      select: {
        player1Id: true,
        player2Id: true,
      },
    })

    const previousRoundParticipantIds = new Set<string>()
    previousMatches.forEach(match => {
      previousRoundParticipantIds.add(match.player1Id)
      if (match.player1Id !== match.player2Id) {
        previousRoundParticipantIds.add(match.player2Id)
      }
    })

    if (previousRoundParticipantIds.size > 0) {
      participantFilter.id = {
        in: Array.from(previousRoundParticipantIds),
      }
    }
  } else {
    // 第1回戦前は、チェックイン済みの参加者のみ
    participantFilter.checkedIn = true
  }

  const participants = await prisma.participant.findMany({
    where: participantFilter,
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
    // バイの試合（player1Id === player2Id）を除外してマッチを取得
    const allMatches = [
      ...participant.matchesAsPlayer1
        .filter((m) => m.player1Id !== m.player2Id) // バイの試合を除外
        .map((m) => ({
          opponent: m.player2,
          result: m.result,
        })),
      ...participant.matchesAsPlayer2
        .filter((m) => m.player1Id !== m.player2Id) // バイの試合を除外
        .map((m) => ({
          opponent: m.player1,
          result: m.result === 'PLAYER1' ? 'PLAYER2' : m.result === 'PLAYER2' ? 'PLAYER1' : 'DRAW',
        })),
    ]
    
    // バイの試合をカウント（player1Id === player2Id の試合）
    const byeMatches = participant.matchesAsPlayer1.filter((m) => m.player1Id === m.player2Id)

    // 実際のマッチ結果からwins, losses, draws, pointsを再計算
    let wins = 0
    let losses = 0
    let draws = 0
    let points = 0

    // 通常の試合をカウント
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
    
    // バイの試合をカウント（バイを受けたプレイヤーは自動的に勝利）
    wins += byeMatches.length
    points += byeMatches.length * 3

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
    const gameWins = wins

    return prisma.participant.update({
      where: { id: participant.id },
      data: {
        wins,
        losses,
        draws,
        points,
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

