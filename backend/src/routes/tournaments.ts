import express from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest, requireRole } from '../middleware/auth'
import { generatePairings, calculateStandings, generateTournamentBracket } from '../services/tournamentService'
import { transformTournament, transformMatch } from '../utils/tournamentTransform'
import { parseJSTISOString, getJSTNow } from '../utils/dateUtils'
import QRCode from 'qrcode'
import bcrypt from 'bcryptjs'

const router = express.Router()

// 大会一覧取得
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    // 一般ユーザーはisPublic=trueのみ、管理者と開催者は全て表示
    const isAdmin = req.user?.role === 'admin'
    const whereClause: any = {}
    
    if (!isAdmin) {
      // 一般ユーザーまたは主催者の場合
      whereClause.OR = [
        { isPublic: true }, // 公開されている大会
        { organizerId: req.userId! }, // または自分が主催している大会
      ]
    }

    const tournaments = await prisma.tournament.findMany({
      where: whereClause,
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
          where: {
            cancelledAt: null,
          },
        },
      },
      orderBy: [
        { eventDate: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    res.json(tournaments.map((tournament: any) => {
      const confirmedCount = tournament.participants.filter((p: any) => !p.isWaitlist).length
      const transformed = transformTournament(tournament)
      return {
        ...transformed,
        participantCount: confirmedCount,
      }
    }))
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

    const result = participants.map((p: any) => ({
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

// 大会情報更新（管理者または主催者のみ）
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 権限チェック: 管理者または主催者（自分の主催する大会のみ）
    if (req.user?.role !== 'admin' && tournament.organizerId !== req.userId) {
      return res.status(403).json({ message: '権限がありません' })
    }

    const {
      name,
      description,
      logoImageUrl,
      entryFee,
      venueName,
      venueAddress,
      eventDate,
      registrationTime,
      registrationEndTime,
      startTime,
      capacity,
      entryStartAt,
      entryEndAt,
      isPublic,
    } = req.body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (logoImageUrl !== undefined) updateData.logoImageUrl = logoImageUrl
    if (entryFee !== undefined) updateData.entryFee = entryFee
    if (venueName !== undefined) updateData.venueName = venueName
    if (venueAddress !== undefined) updateData.venueAddress = venueAddress
    if (eventDate !== undefined) updateData.eventDate = eventDate ? parseJSTISOString(eventDate) : null
    if (registrationTime !== undefined) updateData.registrationTime = registrationTime ? parseJSTISOString(registrationTime) : null
    if (registrationEndTime !== undefined) updateData.registrationEndTime = registrationEndTime ? parseJSTISOString(registrationEndTime) : null
    if (startTime !== undefined) updateData.startTime = startTime ? parseJSTISOString(startTime) : null
    if (capacity !== undefined) updateData.capacity = capacity
    if (entryStartAt !== undefined) updateData.entryStartAt = entryStartAt ? parseJSTISOString(entryStartAt) : null
    if (entryEndAt !== undefined) updateData.entryEndAt = entryEndAt ? parseJSTISOString(entryEndAt) : null
    if (isPublic !== undefined) updateData.isPublic = isPublic

    const updatedTournament = await prisma.tournament.update({
      where: { id: req.params.id },
      data: updateData,
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

    res.json(transformTournament(updatedTournament))
  } catch (error) {
    console.error('Update tournament error:', error)
    res.status(500).json({ message: '大会情報の更新に失敗しました' })
  }
})

// 大会作成
router.post('/', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const { name, description, logoImageUrl, entryFee, preliminaryRounds, tournamentSize, entryStartAt, entryEndAt, capacity, eventDate, registrationTime, registrationEndTime, startTime, venueName, venueAddress, isPublic } = req.body

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
        logoImageUrl: logoImageUrl || null,
        entryFee: entryFee ? parseInt(entryFee) : null,
        organizerId: req.userId!,
        checkInQrCode: qrCodeData,
        preliminaryRounds: JSON.stringify(preliminaryRounds),
        tournamentSize,
        entryStartAt: entryStartAt ? parseJSTISOString(entryStartAt) : null,
        entryEndAt: entryEndAt ? parseJSTISOString(entryEndAt) : null,
        capacity: capacity ? parseInt(capacity) : null,
        eventDate: eventDate ? parseJSTISOString(eventDate) : null,
        registrationTime: registrationTime ? parseJSTISOString(registrationTime) : null,
        registrationEndTime: registrationEndTime ? parseJSTISOString(registrationEndTime) : null,
        startTime: startTime ? parseJSTISOString(startTime) : null,
        venueName: venueName || null,
        venueAddress: venueAddress || null,
        isPublic: isPublic !== undefined ? isPublic : true, // デフォルトはtrue
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Create tournament error details:', { errorMessage, errorStack })
    res.status(500).json({ 
      message: '大会の作成に失敗しました',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    })
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

    const now = getJSTNow()
    const isEntryPeriod = tournament.entryStartAt && tournament.entryEndAt
      ? now >= tournament.entryStartAt && now <= tournament.entryEndAt
      : false

    // 定員内の参加者数
    const confirmedCount = tournament.participants.filter((p: any) => !p.isWaitlist).length
    const waitlistCount = tournament.participants.filter((p: any) => p.isWaitlist).length
    
    // デバッグ用（本番では削除可能）
    console.log('Entry status calculation:', {
      tournamentId: req.params.id,
      totalParticipants: tournament.participants.length,
      confirmedCount,
      waitlistCount,
      capacity: tournament.capacity,
      participants: tournament.participants.map((p: any) => ({
        id: p.id,
        userId: p.userId,
        isWaitlist: p.isWaitlist,
        cancelledAt: p.cancelledAt,
      })),
    })

    // 現在のユーザーのエントリー状況
    const myEntry = tournament.participants.find((p: any) => p.userId === req.userId!)

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Get entry status error details:', { errorMessage, errorStack })
    res.status(500).json({ 
      message: 'エントリー状況の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    })
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

    const now = getJSTNow()
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

    // 既にエントリー済みで、キャンセルも棄権もしていない場合はエラー
    if (existingEntry && !existingEntry.cancelledAt && !existingEntry.dropped) {
      return res.status(400).json({ message: '既にエントリー済みです' })
    }

    // 定員内の参加者数を正確に計算（enteredAt順でソートしてから判定）
    // 現在エントリーしようとしている参加者を除いた、既存の参加者で計算
    const sortedParticipants = [...tournament.participants]
      .filter(p => p.id !== existingEntry?.id) // 再エントリーの場合は既存の参加者を除外
      .sort((a, b) => {
        const dateA = a.enteredAt.getTime()
        const dateB = b.enteredAt.getTime()
        if (dateA !== dateB) {
          return dateA - dateB
        }
        // 同じenteredAtの場合はcreatedAtでソート（より早く作成された方が先）
        return a.createdAt.getTime() - b.createdAt.getTime()
      })

    // 既存の参加者で定員内の人数を計算（isWaitlist: falseの人数）
    const confirmedCount = sortedParticipants.filter(p => !p.isWaitlist).length
    // 現在エントリーしようとしている参加者を含めて判定
    const isWaitlist = tournament.capacity !== null && confirmedCount >= tournament.capacity

    // エントリー作成または再エントリー
    if (existingEntry && (existingEntry.cancelledAt || existingEntry.dropped)) {
      // 再エントリー（キャンセルまたは棄権したユーザー）
      // enteredAtを現在時刻に更新して、エントリーNo.を最後にする
      const participant = await prisma.participant.update({
        where: { id: existingEntry.id },
        data: {
          enteredAt: getJSTNow(), // 再エントリー時は現在時刻に更新（エントリーNo.が最後になる）
          isWaitlist,
          cancelledAt: null,
          dropped: false, // 棄権フラグをリセット
          droppedAt: null, // 棄権日時をリセット
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
      // 同じ時刻でエントリーされた場合でも、createdAtで順序が決まるようにする
      const participant = await prisma.participant.create({
        data: {
          tournamentId: req.params.id,
          userId: req.userId!,
          enteredAt: getJSTNow(),
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

// 参加者を強制キャンセル（管理者または主催者のみ）
router.post('/:id/participants/:participantId/cancel', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 権限チェック: 管理者または主催者（自分の主催する大会のみ）
    if (req.user?.role !== 'admin' && tournament.organizerId !== req.userId) {
      return res.status(403).json({ message: '権限がありません' })
    }

    const participant = await prisma.participant.findUnique({
      where: { id: req.params.participantId },
    })

    if (!participant) {
      return res.status(404).json({ message: '参加者が見つかりません' })
    }

    if (participant.tournamentId !== req.params.id) {
      return res.status(400).json({ message: 'この参加者はこの大会の参加者ではありません' })
    }

    if (participant.cancelledAt) {
      return res.status(400).json({ message: '既にキャンセル済みです' })
    }

    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        cancelledAt: new Date(),
        // チェックイン済みユーザーをキャンセルする場合、チェックイン状態もリセット
        checkedIn: false,
        checkedInAt: null,
      },
    })

    // キャンセル待ちの人を定員内に移動（定員に空きがある限り繰り上げる）
    const tournamentWithParticipants = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        participants: {
          where: {
            cancelledAt: null,
          },
        },
      },
    })

    if (tournamentWithParticipants) {
      // 定員内の参加者数（isWaitlist: falseの人数）
      const confirmedCount = tournamentWithParticipants.participants.filter((p: any) => !p.isWaitlist).length
      const capacity = tournamentWithParticipants.capacity
      
      // 定員に空きがある場合、キャンセル待ちの最初の人を定員内に移動
      if (capacity === null || confirmedCount < capacity) {
        const waitlistParticipants = tournamentWithParticipants.participants
          .filter((p: any) => p.isWaitlist)
          .sort((a: any, b: any) => {
            const dateA = a.enteredAt.getTime()
            const dateB = b.enteredAt.getTime()
            if (dateA !== dateB) {
              return dateA - dateB
            }
            return a.createdAt.getTime() - b.createdAt.getTime()
          })
        
        // 定員に空きがある限り繰り上げる
        const slotsAvailable = capacity === null ? waitlistParticipants.length : capacity - confirmedCount
        const participantsToPromote = waitlistParticipants.slice(0, slotsAvailable)
        
        for (const participant of participantsToPromote) {
          await prisma.participant.update({
            where: { id: participant.id },
            data: {
              isWaitlist: false,
            },
          })
        }
      }
    }

    res.json({ message: '参加者をキャンセルしました' })
  } catch (error) {
    console.error('Force cancel participant error:', error)
    res.status(500).json({ message: '参加者のキャンセルに失敗しました' })
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
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

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
      orderBy: [
        { enteredAt: 'asc' }, // エントリー順でソート
        { createdAt: 'asc' }, // 同じenteredAtの場合は作成順でソート
      ],
    })

    // isWaitlistを再計算（エントリー順で定員内かどうかを判定）
    const maxParticipants = tournament.capacity || 0
    const result = participants.map((p: any, index: number) => {
      const isWaitlist = maxParticipants > 0 && index >= maxParticipants
      return {
        ...p,
        isWaitlist,
      }
    })

    res.json(result)
  } catch (error) {
    console.error('Get participants error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Get participants error details:', { errorMessage, errorStack })
    res.status(500).json({ 
      message: '参加者一覧の取得に失敗しました',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    })
  }
})

// 参加者のチェックイン/チェックアウト（管理者または主催者のみ）
router.post('/:id/participants/:participantId/checkin', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 権限チェック: 管理者または主催者（自分の主催する大会のみ）
    if (req.user?.role !== 'admin' && tournament.organizerId !== req.userId) {
      return res.status(403).json({ message: '権限がありません' })
    }

    // 受付時間中かチェック
    const now = getJSTNow()
    const isRegistrationPeriod = tournament.registrationTime && tournament.registrationEndTime
      ? now >= tournament.registrationTime && now <= tournament.registrationEndTime
      : false

    if (!isRegistrationPeriod) {
      return res.status(400).json({ message: '受付時間中のみチェックイン可能です' })
    }

    const participant = await prisma.participant.findUnique({
      where: { id: req.params.participantId },
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

    if (!participant) {
      return res.status(404).json({ message: '参加者が見つかりません' })
    }

    if (participant.tournamentId !== req.params.id) {
      return res.status(400).json({ message: '無効なリクエストです' })
    }

    // チェックイン/チェックアウトをトグル
    const updatedParticipant = await prisma.participant.update({
      where: { id: req.params.participantId },
      data: {
        checkedIn: !participant.checkedIn,
        checkedInAt: !participant.checkedIn ? new Date() : null,
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

    res.json(updatedParticipant)
  } catch (error) {
    console.error('Check-in toggle error:', error)
    res.status(500).json({ message: 'チェックイン処理に失敗しました' })
  }
})

// ゲストユーザーを追加（管理者または主催者のみ）
router.post('/:id/participants/guest', authenticate, async (req: AuthRequest, res) => {
  try {
    const { playerName } = req.body
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        participants: {
          where: {
            cancelledAt: null,
          },
        },
      },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 権限チェック: 管理者または主催者（自分の主催する大会のみ）
    if (req.user?.role !== 'admin' && tournament.organizerId !== req.userId) {
      return res.status(403).json({ message: '権限がありません' })
    }

    // ゲスト追加は受付時間外でも可能（管理者/主催者のみ）

    if (!playerName || playerName.trim() === '') {
      return res.status(400).json({ message: 'プレイヤー名を入力してください' })
    }

    // ゲストユーザー用の一時的なemailを生成
    const guestEmail = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}@guest.local`
    const hashedPassword = await bcrypt.hash('guest', 10)

    // ゲストユーザーを作成
    const guestUser = await prisma.user.create({
      data: {
        email: guestEmail,
        name: playerName.trim(),
        password: hashedPassword,
        role: 'USER',
      },
    })

    // 定員内の参加者数を計算
    const confirmedCount = tournament.participants.filter((p: any) => !p.isWaitlist).length
    const isWaitlist = tournament.capacity !== null && confirmedCount >= tournament.capacity

    // 参加者として追加（エントリー済みだが、チェックインは未チェック）
    const participant = await prisma.participant.create({
      data: {
        tournamentId: req.params.id,
        userId: guestUser.id,
        enteredAt: getJSTNow(),
        isWaitlist,
        checkedIn: false, // ゲストユーザーも他のユーザーと同じく手動でチェックイン
        checkedInAt: null,
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

    res.json(participant)
  } catch (error) {
    console.error('Add guest user error:', error)
    res.status(500).json({ message: 'ゲストユーザーの追加に失敗しました' })
  }
})

// 対戦一覧取得
router.get('/:id/matches', authenticate, async (req: AuthRequest, res) => {
  try {
    const { round } = req.query
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 対戦表が公開されていない場合、管理者/開催者のみアクセス可能
    const isAdmin = req.user?.role === 'admin'
    const isOrganizer = tournament.organizerId === req.userId
    if (!tournament.matchesVisible && !isAdmin && !isOrganizer) {
      return res.status(403).json({ message: '対戦表はまだ公開されていません' })
    }

    const where: any = { tournamentId: req.params.id }
    const requestedRound = round ? parseInt(round as string) : null
    if (requestedRound) {
      where.round = requestedRound
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
        { tableNumber: 'asc' },
        { matchNumber: 'asc' },
      ],
    })

    // その回戦以前の勝ち点を計算
    const pointsBeforeRoundMap = new Map<string, number>()
    if (requestedRound) {
      // その回戦以前のマッチを取得
      const previousMatches = await prisma.match.findMany({
        where: {
          tournamentId: req.params.id,
          round: { lt: requestedRound },
          result: { not: null },
        },
      })

      // 各プレイヤーの勝ち点を計算
      for (const prevMatch of previousMatches) {
        // BYEマッチ（player1Id === player2Id）の処理
        if (prevMatch.player1Id === prevMatch.player2Id) {
          // BYEマッチの場合、player1が自動的に勝利（3点）
          const current = pointsBeforeRoundMap.get(prevMatch.player1Id) || 0
          pointsBeforeRoundMap.set(prevMatch.player1Id, current + 3)
          continue
        }

        const result = prevMatch.result?.toUpperCase()
        let player1Points = 0
        let player2Points = 0

        if (result === 'PLAYER1') {
          player1Points = 3
        } else if (result === 'PLAYER2') {
          player2Points = 3
        } else if (result === 'DRAW') {
          player1Points = 1
          player2Points = 1
        }
        // BOTH_LOSSの場合は0点

        const current1 = pointsBeforeRoundMap.get(prevMatch.player1Id) || 0
        const current2 = pointsBeforeRoundMap.get(prevMatch.player2Id) || 0
        pointsBeforeRoundMap.set(prevMatch.player1Id, current1 + player1Points)
        pointsBeforeRoundMap.set(prevMatch.player2Id, current2 + player2Points)
      }
    }

    res.json(matches.map(match => transformMatch(match, {
      player1Points: pointsBeforeRoundMap.get(match.player1Id) || 0,
      player2Points: pointsBeforeRoundMap.get(match.player2Id) || 0,
    })))
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

    // 管理者/開催者の権限チェック
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    const isAdmin = req.user?.role === 'admin'
    const isOrganizer = tournament.organizerId === req.userId
    const isPlayer1 = match.player1.userId === req.userId!
    const isPlayer2 = match.player2.userId === req.userId!

    // プレビュー用のマッチ（isTournamentMatch: false）には結果を登録できない
    if (!match.isTournamentMatch && !isAdmin && !isOrganizer) {
      return res.status(403).json({ message: 'この対戦表はまだ開始されていません' })
    }

    // 管理者/開催者でない場合、対戦者のみ登録可能
    if (!isAdmin && !isOrganizer) {
      if (!isPlayer1 && !isPlayer2) {
        return res.status(403).json({ message: 'この対戦の結果を登録する権限がありません' })
      }

      if (match.result) {
        return res.status(400).json({ message: '既に結果が登録されています' })
      }

      // 勝者が登録しているか確認（管理者/開催者以外の場合のみ）
      if (result === 'player1' && !isPlayer1) {
        return res.status(400).json({ message: '勝者が結果を登録してください' })
      }
      if (result === 'player2' && !isPlayer2) {
        return res.status(400).json({ message: '勝者が結果を登録してください' })
      }
      if (result === 'draw' && !isPlayer1 && !isPlayer2) {
        return res.status(400).json({ message: '対戦者のみ結果を登録できます' })
      }
      // 両者敗北は管理者/開催者のみ登録可能
      if (result === 'both_loss' && !isAdmin && !isOrganizer) {
        return res.status(403).json({ message: '両者敗北は管理者/開催者のみ登録できます' })
      }
    }
    // 管理者/開催者の場合、既に結果が登録されている場合でも更新可能（結果登録のやり直し）

    // 既存の結果がある場合、成績を元に戻す（管理者/開催者の結果変更時）
    if (match.result && (isAdmin || isOrganizer)) {
      const oldResult = typeof match.result === 'string' ? match.result.toUpperCase() : match.result
      const oldPlayer1Wins = oldResult === 'PLAYER1' ? 1 : 0
      const oldPlayer1Losses = oldResult === 'PLAYER2' || oldResult === 'BOTH_LOSS' ? 1 : 0
      const oldPlayer1Draws = oldResult === 'DRAW' ? 1 : 0
      const oldPlayer1Points = oldResult === 'PLAYER1' ? 3 : oldResult === 'DRAW' ? 1 : 0

      const oldPlayer2Wins = oldResult === 'PLAYER2' ? 1 : 0
      const oldPlayer2Losses = oldResult === 'PLAYER1' || oldResult === 'BOTH_LOSS' ? 1 : 0
      const oldPlayer2Draws = oldResult === 'DRAW' ? 1 : 0
      const oldPlayer2Points = oldResult === 'PLAYER2' ? 3 : oldResult === 'DRAW' ? 1 : 0

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
    const player1Losses = result === 'player2' || result === 'both_loss' ? 1 : 0
    const player1Draws = result === 'draw' ? 1 : 0
    const player1Points = result === 'player1' ? 3 : result === 'draw' ? 1 : 0

    const player2Wins = result === 'player2' ? 1 : 0
    const player2Losses = result === 'player1' || result === 'both_loss' ? 1 : 0
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

    // レスポンスを先に返す
    res.json(transformedMatch)

    // そのラウンドの全対戦が完了した場合、または管理者/開催者が結果を修正した場合は順位計算を実行（非同期で実行）
    const round = updatedMatch.round
    ;(async () => {
      try {
        const totalMatchesInRound = await prisma.match.count({
          where: {
            tournamentId: req.params.id,
            round,
          },
        })
        const completedMatchesInRound = await prisma.match.count({
          where: {
            tournamentId: req.params.id,
            round,
            result: { not: null },
          },
        })

        // 全対戦が完了した場合、または管理者/開催者が結果を修正した場合は順位計算を実行
        if (totalMatchesInRound === completedMatchesInRound || (isAdmin || isOrganizer)) {
          await calculateStandings(req.params.id)
        }
      } catch (error) {
        console.error('Background standings calculation error:', error)
      }
    })()
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
        checkedIn: true, // チェックインしている人のみ
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

    res.json(participants.map((p: any) => ({
      participant: p,
      rank: p.rank,
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
    const { preliminaryRounds, maxRounds } = req.body

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

    if (tournament.status !== 'DRAFT' && tournament.status !== 'REGISTRATION' && tournament.status !== 'PREPARING') {
      return res.status(400).json({ message: 'この大会は既に開始されています' })
    }

    // 受付終了時間以降かチェック
    const now = getJSTNow()
    if (tournament.registrationEndTime && now < tournament.registrationEndTime) {
      return res.status(400).json({ message: '受付終了時間以降にマッチングを作成できます' })
    }
    
    // エントリー終了時間を過ぎている場合、ステータスをPREPARINGに変更
    if (tournament.status === 'REGISTRATION' && tournament.entryEndAt && now >= tournament.entryEndAt) {
      await prisma.tournament.update({
        where: { id: req.params.id },
        data: { status: 'PREPARING' },
      })
      // 更新後のトーナメント情報を取得
      const updatedTournament = await prisma.tournament.findUnique({
        where: { id: req.params.id },
        include: {
          participants: {
            where: {
              cancelledAt: null,
            },
          },
        },
      })
      if (updatedTournament) {
        tournament.status = updatedTournament.status as any
      }
    }

    const checkedInCount = tournament.participants.filter((p: any) => p.checkedIn).length
    if (checkedInCount < 2) {
      return res.status(400).json({ message: 'チェックイン済みの参加者が2名未満です' })
    }

    // 予選回戦数と予選終了条件のバリデーション
    if (preliminaryRounds === undefined || preliminaryRounds === null) {
      return res.status(400).json({ message: '予選回戦数または予選終了条件を指定してください' })
    }

    // maxRoundsの計算
    let calculatedMaxRounds = maxRounds
    if (typeof preliminaryRounds === 'number') {
      calculatedMaxRounds = preliminaryRounds
    } else if (preliminaryRounds === 'until_one_undefeated' || preliminaryRounds === 'until_two_undefeated') {
      // 無敗が1人または2人になるまで続ける場合、maxRoundsは参加者数に応じて設定
      calculatedMaxRounds = Math.ceil(Math.log2(checkedInCount)) + 1
    }

    // ステータスをPREPARINGからIN_PROGRESSに変更（マッチング作成時）
    // ただし、対戦表はまだ参加者には見えない状態（matchesVisible: false）
    await prisma.tournament.update({
      where: { id: req.params.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        preliminaryRounds: JSON.stringify(preliminaryRounds),
        maxRounds: calculatedMaxRounds || 0,
        matchesVisible: false, // 対戦表はまだ非公開
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

// 全試合終了チェック
router.get('/:id/rounds/:round/completed', authenticate, async (req: AuthRequest, res) => {
  try {
    const round = parseInt(req.params.round)
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 該当回戦の全試合を取得
    const matches = await prisma.match.findMany({
      where: {
        tournamentId: req.params.id,
        round,
      },
    })

    // 全試合が終了しているかチェック
    const allCompleted = matches.length > 0 && matches.every((m: any) => m.result !== null)

    res.json({ completed: allCompleted, totalMatches: matches.length, completedMatches: matches.filter((m: any) => m.result !== null).length })
  } catch (error: any) {
    console.error('Check round completed error:', error)
    res.status(500).json({ message: error.message || 'チェックに失敗しました' })
  }
})

// 次の回戦を作成
router.post('/:id/next-round', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: '権限がありません' })
    }

    if (tournament.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: '大会が開始されていません' })
    }

    const currentRound = tournament.currentRound || 0
    const maxRounds = tournament.maxRounds || 0

    // 予定回戦数が残っているかチェック
    if (currentRound >= maxRounds) {
      return res.status(400).json({ message: '予定回戦数に達しています' })
    }

    // 現在の回戦が0の場合は、第1回戦がまだ作成されていない
    if (currentRound === 0) {
      return res.status(400).json({ message: '第1回戦がまだ作成されていません' })
    }

    // 現在の回戦の全試合が終了しているかチェック
    const currentRoundMatches = await prisma.match.findMany({
      where: {
        tournamentId: req.params.id,
        round: currentRound,
      },
    })

    if (currentRoundMatches.length === 0) {
      return res.status(400).json({ message: '現在の回戦に試合がありません' })
    }

    const allCompleted = currentRoundMatches.every((m: any) => m.result !== null)
    if (!allCompleted) {
      return res.status(400).json({ message: '現在の回戦の全試合が終了していません' })
    }

    // 次の回戦を作成（プレビュー用、isTournamentMatch: false）
    const nextRound = currentRound + 1
    
    // 既にプレビュー用の対戦表が存在する場合は削除
    await prisma.match.deleteMany({
      where: {
        tournamentId: req.params.id,
        round: nextRound,
        isTournamentMatch: false,
      },
    })
    
    const matches = await generatePairings(req.params.id, nextRound)

    res.json({
      round: nextRound,
      matches: matches.map(m => transformMatch(m)),
    })
  } catch (error: any) {
    console.error('Create next round error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ 
      message: error.message || '次の回戦の作成に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// 再マッチング（プレビューマッチを削除して新しいプレビューマッチを作成）
router.post('/:id/rounds/:round/rematch', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const round = parseInt(req.params.round)
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: '権限がありません' })
    }

    if (tournament.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: '大会が開始されていません' })
    }

    // 既に開始されている回戦（isTournamentMatch: trueのマッチがある）は再マッチできない
    const activeMatches = await prisma.match.findMany({
      where: {
        tournamentId: req.params.id,
        round: round,
        isTournamentMatch: true,
      },
    })

    if (activeMatches.length > 0) {
      return res.status(400).json({ message: '既に開始されている回戦は再マッチできません' })
    }

    // 既存のプレビューマッチを削除
    await prisma.match.deleteMany({
      where: {
        tournamentId: req.params.id,
        round: round,
        isTournamentMatch: false,
      },
    })

    // 新しいプレビューマッチを作成
    const matches = await generatePairings(req.params.id, round)

    res.json({
      round: round,
      matches: matches.map(m => transformMatch(m)),
    })
  } catch (error: any) {
    console.error('Rematch error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ 
      message: error.message || '再マッチに失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// マッチング生成
router.post('/:id/rounds/:round/pairings', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const round = parseInt(req.params.round)
    const matches = await generatePairings(req.params.id, round)
    res.json(matches.map(m => transformMatch(m)))
  } catch (error: any) {
    console.error('Generate pairings error:', error)
    res.status(500).json({ message: error.message || 'マッチングの生成に失敗しました' })
  }
})

// 対戦開始（対戦表を参加者に公開・有効化）
router.post('/:id/rounds/:round/start', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const round = parseInt(req.params.round)
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: '権限がありません' })
    }

    if (tournament.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: '大会が開始されていません' })
    }

    // プレビュー用の対戦表を有効化（isTournamentMatch: trueに更新）
    const updatedMatches = await prisma.match.updateMany({
      where: {
        tournamentId: req.params.id,
        round: round,
        isTournamentMatch: false,
      },
      data: {
        isTournamentMatch: true,
      },
    })

    // 現在の回戦数を更新
    await prisma.tournament.update({
      where: { id: req.params.id },
      data: {
        currentRound: round,
        maxRounds: Math.max(tournament.maxRounds || 0, round),
        matchesVisible: true, // 対戦表を参加者に公開
      },
    })

    res.json({
      message: `第${round}回戦を開始しました`,
      matchesUpdated: updatedMatches.count,
    })
  } catch (error: any) {
    console.error('Start round error:', error)
    res.status(500).json({ 
      message: error.message || '回戦の開始に失敗しました',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// 対戦開始（対戦表を参加者に公開）
router.post('/:id/start-matches', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: '権限がありません' })
    }

    if (tournament.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: '大会が開始されていません' })
    }

    // 対戦表を公開
    await prisma.tournament.update({
      where: { id: req.params.id },
      data: { matchesVisible: true },
    })

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
    console.error('Start matches error:', error)
    res.status(500).json({ message: '対戦開始に失敗しました' })
  }
})

// 再マッチング（第1回戦の対戦表を再作成）
router.post('/:id/rematch-round1', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: '権限がありません' })
    }

    if (tournament.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: '大会が開始されていません' })
    }

    // 第1回戦の既存のマッチを削除
    await prisma.match.deleteMany({
      where: {
        tournamentId: req.params.id,
        round: 1,
      },
    })

    // 再マッチング
    const matches = await generatePairings(req.params.id, 1)
    res.json(matches.map(m => transformMatch(m)))
  } catch (error: any) {
    console.error('Rematch round 1 error:', error)
    res.status(500).json({ message: error.message || '対戦表の再作成に失敗しました' })
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
    res.json(matches.map(m => transformMatch(m)))
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

    if (!result || !['player1', 'player2', 'draw', 'both_loss'].includes(result.toLowerCase())) {
      return res.status(400).json({ message: '有効な結果を指定してください（player1, player2, draw, both_loss）' })
    }

    const newResult = result.toUpperCase() as 'PLAYER1' | 'PLAYER2' | 'DRAW' | 'BOTH_LOSS'
    const oldResult = match.result

    // 既存の結果がある場合、勝ち点を減算
    if (oldResult) {
      const oldPlayer1Wins = oldResult === 'PLAYER1' ? 1 : 0
      const oldPlayer1Losses = oldResult === 'PLAYER2' || oldResult === 'BOTH_LOSS' ? 1 : 0
      const oldPlayer1Draws = oldResult === 'DRAW' ? 1 : 0
      const oldPlayer1Points = oldResult === 'PLAYER1' ? 3 : oldResult === 'DRAW' ? 1 : 0

      const oldPlayer2Wins = oldResult === 'PLAYER2' ? 1 : 0
      const oldPlayer2Losses = oldResult === 'PLAYER1' || oldResult === 'BOTH_LOSS' ? 1 : 0
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
    const newPlayer1Losses = newResult === 'PLAYER2' || newResult === 'BOTH_LOSS' ? 1 : 0
    const newPlayer1Draws = newResult === 'DRAW' ? 1 : 0
    const newPlayer1Points = newResult === 'PLAYER1' ? 3 : newResult === 'DRAW' ? 1 : 0

    const newPlayer2Wins = newResult === 'PLAYER2' ? 1 : 0
    const newPlayer2Losses = newResult === 'PLAYER1' || newResult === 'BOTH_LOSS' ? 1 : 0
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

    const transformedMatch = transformMatch(updatedMatch)

    // レスポンスを先に返す
    res.json(transformedMatch)

    // 管理者/開催者が結果を修正した場合は常に順位計算を実行（非同期で実行）
    ;(async () => {
      try {
        await calculateStandings(req.params.id)
      } catch (error) {
        console.error('Background standings calculation error:', error)
      }
    })()
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

// アナウンス取得
router.get('/:id/announcement', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        announcement: true,
      },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    res.json({ announcement: tournament.announcement || '' })
  } catch (error) {
    console.error('Get announcement error:', error)
    res.status(500).json({ message: 'アナウンスの取得に失敗しました' })
  }
})

// トーナメントリセット（1回戦開始前に戻す、主催者/管理者のみ）
router.post('/:id/reset', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: '権限がありません' })
    }

    // すべてのマッチを削除
    await prisma.match.deleteMany({
      where: { tournamentId: req.params.id },
    })

    // 参加者の成績をリセット
    await prisma.participant.updateMany({
      where: { tournamentId: req.params.id },
      data: {
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        omw: 0,
        gameWins: 0,
        averageOmw: 0,
        rank: 0,
        tournamentWins: 0,
        tournamentLosses: 0,
        tournamentEliminated: false,
      },
    })

    // トーナメントの状態をリセット
    await prisma.tournament.update({
      where: { id: req.params.id },
      data: {
        currentRound: 0,
        maxRounds: 0,
        status: 'PREPARING',
        matchesVisible: false,
      },
    })

    res.json({ message: 'トーナメントを1回戦開始前にリセットしました' })
  } catch (error) {
    console.error('Reset tournament error:', error)
    res.status(500).json({ message: 'トーナメントのリセットに失敗しました' })
  }
})

// アナウンス更新（主催者/管理者のみ）
router.patch('/:id/announcement', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 主催者または管理者のみ編集可能
    if (tournament.organizerId !== req.userId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'アナウンスの編集権限がありません' })
    }

    const { announcement } = req.body

    const updatedTournament = await prisma.tournament.update({
      where: { id: req.params.id },
      data: {
        announcement: announcement || null,
      },
      select: {
        id: true,
        announcement: true,
      },
    })

    res.json({ announcement: updatedTournament.announcement || '' })
  } catch (error) {
    console.error('Update announcement error:', error)
    res.status(500).json({ message: 'アナウンスの更新に失敗しました' })
  }
})

// 予選順位表発表（管理者または主催者のみ）
router.post('/:id/announce-preliminary-standings', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: '権限がありません' })
    }

    if (tournament.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: '大会が進行中ではありません' })
    }

    // 現在の回戦（最終回戦）の未完了マッチを完了状態にする
    const currentRound = tournament.currentRound || 0
    if (currentRound > 0) {
      // 現在の回戦の全マッチを取得
      const currentRoundMatches = await prisma.match.findMany({
        where: {
          tournamentId: req.params.id,
          round: currentRound,
          result: null, // 結果が未登録のマッチ
        },
      })

      // 未登録のマッチを両者敗北として登録（予選順位発表時点で未完了のマッチは両者敗北として扱う）
      for (const match of currentRoundMatches) {
        await prisma.match.update({
          where: { id: match.id },
          data: {
            result: 'BOTH_LOSS',
            reportedBy: req.userId!,
            reportedAt: getJSTNow(),
          },
        })
      }

      // 順位を再計算（両者敗北のマッチを含めて）
      await calculateStandings(req.params.id)
    }

    // 予選順位発表済みフラグを設定（Tournamentモデルにフラグがないため、completedAtを設定して判定に使用）
    // または、予選完了判定エンドポイントで予選順位発表済みかどうかをチェックする
    // 現時点では、予選順位発表時点で予選が完了しているとみなす

    res.json({ message: '予選順位表を発表しました', preliminaryAnnounced: true })
  } catch (error) {
    console.error('Announce preliminary standings error:', error)
    res.status(500).json({ message: '予選順位表の発表に失敗しました' })
  }
})

// 予選完了判定
router.get('/:id/preliminary-completed', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 順位を再計算
    await calculateStandings(tournament.id)

    // 決勝トーナメントが作成されているかどうかをチェック（予選順位発表済みかどうかの判定）
    // 決勝トーナメントマッチ（isTournamentMatch: true）が存在するかどうかで判定
    const tournamentMatches = await prisma.match.findFirst({
      where: {
        tournamentId: req.params.id,
        isTournamentMatch: true,
      },
      select: { id: true },
    })

    // 決勝トーナメントが作成されている場合、予選は完了している
    const hasTournamentBracket = !!tournamentMatches

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

    let isCompleted = false
    if (hasTournamentBracket) {
      // 決勝トーナメントが作成されている場合、予選は完了している
      isCompleted = true
    } else if (typeof preliminaryRounds === 'number') {
      // 指定回戦数が完了しているか
      // 予選回戦数（preliminaryRounds）の回戦が完了しているかどうかを確認
      const preliminaryRoundMatches = await prisma.match.findMany({
        where: {
          tournamentId: tournament.id,
          round: preliminaryRounds,
          isTournamentMatch: true, // 実際の対戦マッチのみ
        },
      })
      
      // 予選回戦数の回戦が存在し、全て完了している場合
      const preliminaryRoundCompleted = preliminaryRoundMatches.length > 0 && 
        preliminaryRoundMatches.every((m: any) => m.result !== null)
      
      // 現在の回戦が指定回戦数以上で、かつ現在の回戦の全マッチが完了しているか
      const currentRoundMatches = await prisma.match.findMany({
        where: {
          tournamentId: tournament.id,
          round: tournament.currentRound || 0,
          isTournamentMatch: true, // 実際の対戦マッチのみ
        },
      })
      const completedMatches = currentRoundMatches.filter((m: any) => m.result !== null).length
      const allMatchesCompleted = currentRoundMatches.length > 0 && completedMatches === currentRoundMatches.length
      
      console.log(`[予選完了判定] tournamentId: ${tournament.id}, preliminaryRounds: ${preliminaryRounds}, currentRound: ${tournament.currentRound}`)
      console.log(`[予選完了判定] preliminaryRoundMatches: ${preliminaryRoundMatches.length}, preliminaryRoundCompleted: ${preliminaryRoundCompleted}`)
      console.log(`[予選完了判定] currentRoundMatches: ${currentRoundMatches.length}, completedMatches: ${completedMatches}, allMatchesCompleted: ${allMatchesCompleted}`)
      
      // 予選回戦数の回戦が完了している場合、予選完了とみなす（最優先）
      if (preliminaryRoundCompleted) {
        isCompleted = true
        console.log(`[予選完了判定] 予定回戦数(${preliminaryRounds}回戦)が完了しているため、予選完了と判定`)
      }
      // または、currentRound >= preliminaryRounds かつ現在の回戦の全マッチ完了の場合
      // （予定回戦数に達していて、その回戦が完了している場合）
      else if (tournament.currentRound >= preliminaryRounds && allMatchesCompleted) {
        isCompleted = true
        console.log(`[予選完了判定] 現在の回戦(${tournament.currentRound})が予定回戦数(${preliminaryRounds})以上で、全マッチ完了のため、予選完了と判定`)
      }
      // もし currentRound < preliminaryRounds でも、現在の回戦の全マッチが完了していれば予選完了とみなす
      // （予選順位発表が押された場合、未完了マッチはBOTH_LOSSとして登録されるため）
      else if (!isCompleted && allMatchesCompleted && tournament.currentRound > 0) {
        // 予選順位発表が押された可能性がある（全マッチが完了している）
        // この場合、予選完了とみなす
        isCompleted = true
        console.log(`[予選完了判定] 現在の回戦(${tournament.currentRound})の全マッチが完了しているため、予選完了と判定`)
      } else {
        console.log(`[予選完了判定] 予選未完了: preliminaryRoundCompleted=${preliminaryRoundCompleted}, currentRound>=preliminaryRounds=${tournament.currentRound >= preliminaryRounds}, allMatchesCompleted=${allMatchesCompleted}`)
      }
    } else if (preliminaryRounds === 'until_one_undefeated') {
      // 全勝者が1人になるまで
      // 現在の回戦が完了していて、全勝者が1人かどうかを確認
      const participants = await prisma.participant.findMany({
        where: {
          tournamentId: tournament.id,
          checkedIn: true,
          dropped: false,
          cancelledAt: null,
        },
      })
      const undefeatedCount = participants.filter((p: any) => p.losses === 0).length
      isCompleted = undefeatedCount <= 1
    } else if (preliminaryRounds === 'until_two_undefeated') {
      // 全勝者が2人以下になるまで
      const participants = await prisma.participant.findMany({
        where: {
          tournamentId: tournament.id,
          checkedIn: true,
          dropped: false,
          cancelledAt: null,
        },
      })
      const undefeatedCount = participants.filter((p: any) => p.losses === 0).length
      isCompleted = undefeatedCount <= 2
    }

    res.json({ isCompleted })
  } catch (error) {
    console.error('Check preliminary completed error:', error)
    res.status(500).json({ message: '予選完了判定に失敗しました' })
  }
})

// 決勝トーナメント作成
router.post('/:id/create-tournament-bracket', authenticate, requireRole('organizer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    if (tournament.organizerId !== req.userId && req.user?.role !== 'admin') {
      return res.status(403).json({ message: '権限がありません' })
    }

    if (tournament.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: '大会が進行中ではありません' })
    }

    // 既に決勝トーナメントが作成されているかチェック
    const maxRound = await prisma.match.findFirst({
      where: { tournamentId: req.params.id },
      orderBy: { round: 'desc' },
      select: { round: true },
    })

    const startRound = (maxRound?.round || 0) + 1

    const existingTournamentMatches = await prisma.match.findFirst({
      where: {
        tournamentId: req.params.id,
        round: { gte: startRound },
      },
    })

    if (existingTournamentMatches) {
      return res.status(400).json({ message: '決勝トーナメントは既に作成されています' })
    }

    // 決勝トーナメントマッチを生成
    const matches = await generateTournamentBracket(req.params.id)

    res.json({ 
      message: '決勝トーナメントを作成しました',
      matches: matches.map(m => transformMatch(m)),
    })
  } catch (error) {
    console.error('Create tournament bracket error:', error)
    res.status(500).json({ message: '決勝トーナメントの作成に失敗しました' })
  }
})

// 決勝トーナメントマッチ取得
router.get('/:id/tournament-bracket', authenticate, async (req: AuthRequest, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.id },
    })

    if (!tournament) {
      return res.status(404).json({ message: '大会が見つかりません' })
    }

    // 予選の最大roundを取得
    const maxRound = await prisma.match.findFirst({
      where: { tournamentId: req.params.id },
      orderBy: { round: 'desc' },
      select: { round: true },
    })

    if (!maxRound) {
      return res.json({ matches: [], rounds: [] })
    }

    // 決勝トーナメントのマッチを取得（予選の最終roundより後のround）
    const tournamentMatches = await prisma.match.findMany({
      where: {
        tournamentId: req.params.id,
        round: { gt: maxRound.round },
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
      orderBy: [
        { round: 'asc' },
        { matchNumber: 'asc' },
      ],
    })

    // ラウンドごとにグループ化
    const roundsMap = new Map<number, any[]>()
    for (const match of tournamentMatches) {
      if (!roundsMap.has(match.round)) {
        roundsMap.set(match.round, [])
      }
      roundsMap.get(match.round)!.push(transformMatch(match))
    }

    const rounds = Array.from(roundsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, matches]) => ({ round, matches }))

    res.json({ matches: tournamentMatches.map(m => transformMatch(m)), rounds })
  } catch (error) {
    console.error('Get tournament bracket error:', error)
    res.status(500).json({ message: '決勝トーナメントの取得に失敗しました' })
  }
})

export default router

