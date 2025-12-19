import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { generatePairings, calculateStandings } from '../services/tournamentService'
import { transformTournament, transformMatch } from '../utils/tournamentTransform'
import QRCode from 'qrcode'

const router = express.Router()
const prisma = new PrismaClient()

// 大会一覧取得
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { eventDate: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    res.json(tournaments.map(transformTournament))
  } catch (error) {
    console.error('Get tournaments error:', error)
    res.status(500).json({ message: '大会一覧の取得に失敗しました' })
  }
})

// 参加した大会一覧取得（エントリー状況含む）
router.get('/my-participations', authenticate, async (req: AuthRequest, res) => {
  try {
    const participants = await prisma.participant.findMany({
      where: {
        userId: req.userId!,
      },
      include: {
        tournament: {
          include: {
            organizer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        enteredAt: 'desc',
      },
    })

    const result = participants.map((p) => ({
      tournament: transformTournament(p.tournament),
      participant: {
        id: p.id,
        enteredAt: p.enteredAt,
        isWaitlist: p.isWaitlist,
        cancelledAt: p.cancelledAt,
        checkedIn: p.checkedIn,
      },
    }))

    res.json(result)
  } catch (error) {
    console.error('Get my participations error:', error)
    res.status(500).json({ message: '参加大会の取得に失敗しました' })
  }
})

// 大会詳細取得
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    res.json(transformTournament(tournament))
  } catch (error) {
    console.error('Get tournament error:', error)
    res.status(500).json({ message: '大会情報の取得に失敗しました' })
  }
})

// 大会作成
router.post('/', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const { name, description, preliminaryRounds, tournamentSize, entryStartAt, entryEndAt, capacity, eventDate, registrationTime, startTime } = req.body

    if (!name || !preliminaryRounds || !tournamentSize) {
      return res.status(400).json({ message: '必須項目が不足しています' })
    }

    if (![4, 8, 16, 32].includes(tournamentSize)) {
      return res.status(400).json({ message: 'トーナメントサイズは4, 8, 16, 32のいずれかである必要があります' })
    }

    const qrCodeData = `TOURNAMENT:${Date.now()}:${Math.random().toString(36).substring(7)}`
    const qrCodeImage = await QRCode.toDataURL(qrCodeData)

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description,
        organizerId: req.userId!,
        checkInQrCode: qrCodeData,
        preliminaryRounds: JSON.stringify(preliminaryRounds),
        tournamentSize,
        entryStartAt: entryStartAt ? new Date(entryStartAt) : null,
        entryEndAt: entryEndAt ? new Date(entryEndAt) : null,
        capacity: capacity ? parseInt(capacity) : null,
        eventDate: eventDate ? new Date(eventDate) : null,
        registrationTime: registrationTime ? new Date(registrationTime) : null,
        startTime: startTime ? new Date(startTime) : null,
        status: 'DRAFT',
      },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    res.json(transformTournament(tournament))
  } catch (error) {
    console.error('Create tournament error:', error)
    res.status(500).json({ message: '大会の作成に失敗しました' })
  }
})

// エントリー状況取得
router.get('/:id/entry-status', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        participants: {
          where: {
            cancelledAt: null, // キャンセルされていない参加者
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            enteredAt: 'asc',
          },
        },
      },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    const now = new Date()
    const isEntryPeriod = tournament.entryStartAt && tournament.entryEndAt
      ? now >= tournament.entryStartAt && now <= tournament.entryEndAt
      : false

    // 定員内の参加者数
    const confirmedCount = tournament.participants.filter(p => !p.isWaitlist).length
    const waitlistCount = tournament.participants.filter(p => p.isWaitlist).length

    // 現在のユーザーのエントリー状況
    const myEntry = tournament.participants.find(p => p.userId === req.userId!)

    res.json({
      tournament: transformTournament(tournament),
      isEntryPeriod,
      confirmedCount,
      waitlistCount,
      capacity: tournament.capacity,
      myEntry: myEntry ? {
        id: myEntry.id,
        enteredAt: myEntry.enteredAt,
        isWaitlist: myEntry.isWaitlist,
        cancelledAt: myEntry.cancelledAt,
      } : null,
    })
  } catch (error) {
    console.error('Get entry status error:', error)
    res.status(500).json({ message: 'エントリー状況の取得に失敗しました' })
  }
})

// エントリー
router.post('/:id/entry', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        participants: {
          where: {
            cancelledAt: null,
          },
          orderBy: {
            enteredAt: 'asc',
          },
        },
      },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    const now = new Date()
    // エントリー期間のチェック
    if (tournament.entryStartAt && tournament.entryEndAt) {
      if (now < tournament.entryStartAt) {
        return res.status(400).json({ message: 'エントリー期間前です' })
      }
      if (now > tournament.entryEndAt) {
        return res.status(400).json({ message: 'エントリー期間が終了しました' })
      }
    }

    // 既にエントリーしているか確認
    const existingEntry = await prisma.participant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: req.params.id,
          userId: req.userId!,
        },
      },
    })

    if (existingEntry && !existingEntry.cancelledAt) {
      return res.status(400).json({ message: '既にエントリー済みです' })
    }

    // 定員内の参加者数
    const confirmedCount = tournament.participants.filter(p => !p.isWaitlist).length
    const isWaitlist = tournament.capacity !== null && confirmedCount >= tournament.capacity

    // エントリー作成または再エントリー
    if (existingEntry && existingEntry.cancelledAt) {
      // 再エントリー
      const participant = await prisma.participant.update({
        where: { id: existingEntry.id },
        data: {
          enteredAt: new Date(),
          isWaitlist,
          cancelledAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      res.json({
        participant,
        isWaitlist,
        message: isWaitlist ? 'キャンセル待ちでエントリーしました' : 'エントリーしました',
      })
    } else {
      // 新規エントリー
      const participant = await prisma.participant.create({
        data: {
          tournamentId: req.params.id,
          userId: req.userId!,
          enteredAt: new Date(),
          isWaitlist,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      res.json({
        participant,
        isWaitlist,
        message: isWaitlist ? 'キャンセル待ちでエントリーしました' : 'エントリーしました',
      })
    }
  } catch (error) {
    console.error('Entry error:', error)
    res.status(500).json({ message: 'エントリーに失敗しました' })
  }
})

// エントリーキャンセル
router.post('/:id/entry/cancel', authenticate, async (req: AuthRequest, res) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: req.params.id,
          userId: req.userId!,
        },
      },
    })

    if (!participant) {
      return res.status(404).json({ message: 'エントリーが見つかりません' })
    }

    if (participant.cancelledAt) {
      return res.status(400).json({ message: '既にキャンセル済みです' })
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        cancelledAt: new Date(),
      },
    })

    // キャンセル待ちの最初の人を定員内に移動
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        participants: {
          where: {
            cancelledAt: null,
            isWaitlist: true,
          },
          orderBy: {
            enteredAt: 'asc',
          },
          take: 1,
        },
      },
    })

    if (tournament && tournament.participants.length > 0) {
      await prisma.participant.update({
        where: { id: tournament.participants[0].id },
        data: {
          isWaitlist: false,
        },
      })
    }

    res.json({ message: 'エントリーをキャンセルしました' })
  } catch (error) {
    console.error('Cancel entry error:', error)
    res.status(500).json({ message: 'エントリーのキャンセルに失敗しました' })
  }
})

// チェックイン
router.post('/:id/checkin', authenticate, async (req: AuthRequest, res) => {
  try {
    const { qrCode } = req.body
    const tournamentId = req.params.id

    if (!qrCode) {
      return res.status(400).json({ message: 'QRコードを入力してください' })
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (qrCode !== tournament.checkInQrCode) {
      return res.status(400).json({ message: '無効なQRコードです' })
    }

    if (tournament.status !== 'REGISTRATION') {
      return res.status(400).json({ message: 'チェックイン期間ではありません' })
    }

    // 既に参加しているか確認
    const existingParticipant = await prisma.participant.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId,
          userId: req.userId!,
        },
      },
    })

    if (existingParticipant) {
      if (existingParticipant.checkedIn) {
        return res.status(400).json({ message: '既にチェックイン済みです' })
      }

      // チェックイン済みに更新
      await prisma.participant.update({
        where: { id: existingParticipant.id },
        data: {
          checkedIn: true,
          checkedInAt: new Date(),
        },
      })
    } else {
      // 新規参加者として追加
      await prisma.participant.create({
        data: {
          tournamentId,
          userId: req.userId!,
          checkedIn: true,
          checkedInAt: new Date(),
        },
      })
    }

    res.json({ message: 'チェックインが完了しました' })
  } catch (error) {
    console.error('Check-in error:', error)
    res.status(500).json({ message: 'チェックインに失敗しました' })
  }
})

// 参加者一覧取得
router.get('/:id/participants', authenticate, async (req: AuthRequest, res) => {
  try {
    const participants = await prisma.participant.findMany({
      where: {
        tournamentId: req.params.id,
        cancelledAt: null, // キャンセルされていない参加者のみ
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        rank: 'asc',
      },
    })

    res.json(participants)
  } catch (error) {
    console.error('Get participants error:', error)
    res.status(500).json({ message: '参加者一覧の取得に失敗しました' })
  }
})

// 対戦一覧取得
router.get('/:id/matches', authenticate, async (req: AuthRequest, res) => {
  try {
    const { round } = req.query
    const where: any = { tournamentId: req.params.id }
    if (round) {
      where.round = parseInt(round as string)
    }

    const matches = await prisma.match.findMany({
      where,
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
      orderBy: [
        { round: 'asc' },
        { matchNumber: 'asc' },
      ],
    })

    res.json(matches.map(transformMatch))
  } catch (error) {
    console.error('Get matches error:', error)
    res.status(500).json({ message: '対戦一覧の取得に失敗しました' })
  }
})

// 自分の対戦取得
router.get('/:id/matches/my/:round', authenticate, async (req: AuthRequest, res) => {
  try {
    const round = parseInt(req.params.round)
    const match = await prisma.match.findFirst({
      where: {
        tournamentId: req.params.id,
        round,
        OR: [
          { player1: { userId: req.userId! } },
          { player2: { userId: req.userId! } },
        ],
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

    res.json(match ? transformMatch(match) : null)
  } catch (error) {
    console.error('Get my match error:', error)
    res.status(500).json({ message: '対戦情報の取得に失敗しました' })
  }
})

// 結果登録
router.post('/:id/matches/:matchId/result', authenticate, async (req: AuthRequest, res) => {
  try {
    const { result } = req.body
    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      include: {
        player1: true,
        player2: true,
      },
    })

    if (!match) {
      return res.status(404).json({ message: '対戦が見つかりません' })
    }

    if (match.tournamentId !== req.params.id) {
      return res.status(400).json({ message: '無効なリクエストです' })
    }

    // 勝った方が登録することを確認
    const isPlayer1 = match.player1.userId === req.userId!
    const isPlayer2 = match.player2.userId === req.userId!

    if (!isPlayer1 && !isPlayer2) {
      return res.status(403).json({ message: 'この対戦の結果を登録する権限がありません' })
    }

    if (match.result) {
      return res.status(400).json({ message: '既に結果が登録されています' })
    }

    // 勝者が登録しているか確認
    if (result === 'player1' && !isPlayer1) {
      return res.status(400).json({ message: '勝者が結果を登録してください' })
    }
    if (result === 'player2' && !isPlayer2) {
      return res.status(400).json({ message: '勝者が結果を登録してください' })
    }
    if (result === 'draw' && !isPlayer1 && !isPlayer2) {
      return res.status(400).json({ message: '対戦者のみ結果を登録できます' })
    }

    // 結果を登録
    const updatedMatch = await prisma.match.update({
      where: { id: req.params.matchId },
      data: {
        result: result.toUpperCase() as any,
        reportedBy: req.userId!,
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

    const transformedMatch = transformMatch(updatedMatch)

    // 参加者の成績を更新
    const player1Wins = result === 'player1' ? 1 : 0
    const player1Losses = result === 'player2' ? 1 : 0
    const player1Draws = result === 'draw' ? 1 : 0
    const player1Points = result === 'player1' ? 3 : result === 'draw' ? 1 : 0

    const player2Wins = result === 'player2' ? 1 : 0
    const player2Losses = result === 'player1' ? 1 : 0
    const player2Draws = result === 'draw' ? 1 : 0
    const player2Points = result === 'player2' ? 3 : result === 'draw' ? 1 : 0

    await prisma.participant.update({
      where: { id: match.player1Id },
      data: {
        wins: { increment: player1Wins },
        losses: { increment: player1Losses },
        draws: { increment: player1Draws },
        points: { increment: player1Points },
      },
    })

    await prisma.participant.update({
      where: { id: match.player2Id },
      data: {
        wins: { increment: player2Wins },
        losses: { increment: player2Losses },
        draws: { increment: player2Draws },
        points: { increment: player2Points },
      },
    })

    // 順位を再計算
    await calculateStandings(req.params.id)

    res.json(transformedMatch)
  } catch (error) {
    console.error('Report result error:', error)
    res.status(500).json({ message: '結果の登録に失敗しました' })
  }
})

// 順位表取得
router.get('/:id/standings', authenticate, async (req: AuthRequest, res) => {
  try {
    const participants = await prisma.participant.findMany({
      where: {
        tournamentId: req.params.id,
        dropped: false,
        cancelledAt: null, // キャンセルされていない参加者のみ
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { rank: 'asc' },
        { points: 'desc' },
        { omw: 'desc' },
        { gameWins: 'desc' },
        { averageOmw: 'desc' },
      ],
    })

    res.json(participants.map((p, index) => ({
      participant: p,
      rank: index + 1,
      points: p.points,
      omw: p.omw,
      gameWins: p.gameWins,
      averageOmw: p.averageOmw,
    })))
  } catch (error) {
    console.error('Get standings error:', error)
    res.status(500).json({ message: '順位表の取得に失敗しました' })
  }
})

// 大会開始
router.post('/:id/start', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        participants: {
          where: {
            cancelledAt: null, // キャンセルされていない参加者のみ
          },
        },
      },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: '権限がありません' })
    }

    if (tournament.status !== 'DRAFT' && tournament.status !== 'REGISTRATION') {
      return res.status(400).json({ message: 'この大会は既に開始されています' })
    }

    const checkedInCount = tournament.participants.filter((p) => p.checkedIn).length
    if (checkedInCount < 2) {
      return res.status(400).json({ message: 'チェックイン済みの参加者が2名未満です' })
    }

    await prisma.tournament.update({
      where: { id: req.params.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    })

    // 第1回戦のマッチングを生成
    await generatePairings(req.params.id, 1)

    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    res.json(transformTournament(updatedTournament!))
  } catch (error) {
    console.error('Start tournament error:', error)
    res.status(500).json({ message: '大会の開始に失敗しました' })
  }
})

// マッチング生成
router.post('/:id/rounds/:round/pairings', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const round = parseInt(req.params.round)
    const matches = await generatePairings(req.params.id, round)
    res.json(matches.map(transformMatch))
  } catch (error: any) {
    console.error('Generate pairings error:', error)
    res.status(500).json({ message: error.message || 'マッチングの生成に失敗しました' })
  }
})

// 再マッチング
router.post('/:id/rounds/:round/rematch', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const round = parseInt(req.params.round)
    
    // 既存のマッチを削除
    await prisma.match.deleteMany({
      where: {
        tournamentId: req.params.id,
        round,
      },
    })

    // 再マッチング
    const matches = await generatePairings(req.params.id, round)
    res.json(matches.map(transformMatch))
  } catch (error: any) {
    console.error('Rematch error:', error)
    res.status(500).json({ message: error.message || '再マッチングに失敗しました' })
  }
})

// 勝ち点修正（結果変更）- 管理者と開催者のみ
router.patch('/:id/matches/:matchId/points', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const { result } = req.body
    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      include: {
        player1: true,
        player2: true,
        tournament: true,
      },
    })

    if (!match) {
      return res.status(404).json({ message: '対戦が見つかりません' })
    }

    if (match.tournamentId !== req.params.id) {
      return res.status(400).json({ message: '無効なリクエストです' })
    }

    if (!result || !['player1', 'player2', 'draw'].includes(result.toLowerCase())) {
      return res.status(400).json({ message: '有効な結果を指定してください（player1, player2, draw）' })
    }

    const newResult = result.toUpperCase() as 'PLAYER1' | 'PLAYER2' | 'DRAW'
    const oldResult = match.result

    // 既存の結果がある場合、勝ち点を減算
    if (oldResult) {
      const oldPlayer1Wins = oldResult === 'PLAYER1' ? 1 : 0
      const oldPlayer1Losses = oldResult === 'PLAYER2' ? 1 : 0
      const oldPlayer1Draws = oldResult === 'DRAW' ? 1 : 0
      const oldPlayer1Points = oldResult === 'PLAYER1' ? 3 : oldResult === 'DRAW' ? 1 : 0

      const oldPlayer2Wins = oldResult === 'PLAYER2' ? 1 : 0
      const oldPlayer2Losses = oldResult === 'PLAYER1' ? 1 : 0
      const oldPlayer2Draws = oldResult === 'DRAW' ? 1 : 0
      const oldPlayer2Points = oldResult === 'PLAYER2' ? 3 : oldResult === 'DRAW' ? 1 : 0

      // 既存の勝ち点を減算
      await prisma.participant.update({
        where: { id: match.player1Id },
        data: {
          wins: { decrement: oldPlayer1Wins },
          losses: { decrement: oldPlayer1Losses },
          draws: { decrement: oldPlayer1Draws },
          points: { decrement: oldPlayer1Points },
        },
      })

      await prisma.participant.update({
        where: { id: match.player2Id },
        data: {
          wins: { decrement: oldPlayer2Wins },
          losses: { decrement: oldPlayer2Losses },
          draws: { decrement: oldPlayer2Draws },
          points: { decrement: oldPlayer2Points },
        },
      })
    }

    // 新しい結果を設定
    const updatedMatch = await prisma.match.update({
      where: { id: req.params.matchId },
      data: {
        result: newResult,
        reportedBy: req.userId!,
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

    // 新しい勝ち点を加算
    const newPlayer1Wins = newResult === 'PLAYER1' ? 1 : 0
    const newPlayer1Losses = newResult === 'PLAYER2' ? 1 : 0
    const newPlayer1Draws = newResult === 'DRAW' ? 1 : 0
    const newPlayer1Points = newResult === 'PLAYER1' ? 3 : newResult === 'DRAW' ? 1 : 0

    const newPlayer2Wins = newResult === 'PLAYER2' ? 1 : 0
    const newPlayer2Losses = newResult === 'PLAYER1' ? 1 : 0
    const newPlayer2Draws = newResult === 'DRAW' ? 1 : 0
    const newPlayer2Points = newResult === 'PLAYER2' ? 3 : newResult === 'DRAW' ? 1 : 0

    await prisma.participant.update({
      where: { id: match.player1Id },
      data: {
        wins: { increment: newPlayer1Wins },
        losses: { increment: newPlayer1Losses },
        draws: { increment: newPlayer1Draws },
        points: { increment: newPlayer1Points },
      },
    })

    await prisma.participant.update({
      where: { id: match.player2Id },
      data: {
        wins: { increment: newPlayer2Wins },
        losses: { increment: newPlayer2Losses },
        draws: { increment: newPlayer2Draws },
        points: { increment: newPlayer2Points },
      },
    })

    // 順位を再計算
    await calculateStandings(req.params.id)

    const transformedMatch = transformMatch(updatedMatch)
    res.json(transformedMatch)
  } catch (error) {
    console.error('Update points error:', error)
    res.status(500).json({ message: '勝ち点の更新に失敗しました' })
  }
})

// 棄権処理
router.post('/:id/participants/:participantId/drop', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    await prisma.participant.update({
      where: { id: req.params.participantId },
      data: {
        dropped: true,
        droppedAt: new Date(),
      },
    })

    res.json({ message: '棄権処理を完了しました' })
  } catch (error) {
    console.error('Drop participant error:', error)
    res.status(500).json({ message: '棄権処理に失敗しました' })
  }
})

export default router

