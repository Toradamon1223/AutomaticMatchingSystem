// 既存の参加者のisWaitlistフラグを正しく設定するスクリプト
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function fixParticipantWaitlist() {
  try {
    console.log('\n=== 参加者のisWaitlistフラグを修正開始 ===\n')

    // 大会名で大会を検索
    const tournamentName = 'めっちゃいい大会'
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: tournamentName,
        },
      },
    })

    if (!tournament) {
      console.error(`❌ 大会 "${tournamentName}" が見つかりません`)
      return
    }

    console.log(`✅ 大会を見つけました: ${tournament.name} (ID: ${tournament.id})`)
    console.log(`   定員: ${tournament.capacity || '無制限'}人\n`)

    if (!tournament.capacity) {
      console.log('定員が設定されていないため、すべての参加者を定員内として設定します')
    }

    // 参加者を取得（enteredAt順、キャンセルされていないもの）
    const participants = await prisma.participant.findMany({
      where: {
        tournamentId: tournament.id,
        cancelledAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        enteredAt: 'asc',
      },
    })

    console.log(`参加者数: ${participants.length}人\n`)

    if (participants.length === 0) {
      console.log('参加者がいません')
      return
    }

    let confirmedCount = 0
    let waitlistCount = 0

    // 各参加者のisWaitlistフラグを設定
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i]
      const shouldBeWaitlist = tournament.capacity !== null && i >= tournament.capacity

      if (participant.isWaitlist !== shouldBeWaitlist) {
        try {
          await prisma.participant.update({
            where: { id: participant.id },
            data: { isWaitlist: shouldBeWaitlist },
          })

          if (shouldBeWaitlist) {
            waitlistCount++
            console.log(`[${i + 1}/${participants.length}] ✅ ${participant.user.name} → キャンセル待ち`)
          } else {
            confirmedCount++
            console.log(`[${i + 1}/${participants.length}] ✅ ${participant.user.name} → 定員内`)
          }
        } catch (error) {
          console.error(`[${i + 1}/${participants.length}] ❌ ${participant.user.name} - ${error.message}`)
        }
      } else {
        if (shouldBeWaitlist) {
          waitlistCount++
        } else {
          confirmedCount++
        }
      }
    }

    console.log(`\n=== 完了 ===\n`)
    console.log(`定員内: ${confirmedCount}人`)
    console.log(`キャンセル待ち: ${waitlistCount}人`)
    console.log(`合計: ${participants.length}人`)
    console.log('')
  } catch (error) {
    console.error('❌ エラー:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixParticipantWaitlist()






