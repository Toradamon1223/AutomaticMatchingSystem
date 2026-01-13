// 既存の参加者のenteredAtをエントリー順に修正するスクリプト
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function fixParticipantEntryTimes() {
  try {
    console.log('\n=== 参加者のenteredAtを修正開始 ===\n')

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

    console.log(`✅ 大会を見つけました: ${tournament.name} (ID: ${tournament.id})\n`)

    // 参加者を取得（キャンセルされていないもの）
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
    })

    // ユーザー名から番号を抽出してソート
    participants.sort((a, b) => {
      const nameA = a.user.name
      const nameB = b.user.name
      const numA = parseInt(nameA.match(/\d+/)?.[0] || '999999')
      const numB = parseInt(nameB.match(/\d+/)?.[0] || '999999')
      if (numA !== numB) {
        return numA - numB
      }
      // 番号が同じ場合はIDでソート
      return a.id.localeCompare(b.id)
    })

    console.log(`参加者数: ${participants.length}人\n`)

    if (participants.length === 0) {
      console.log('参加者がいません')
      return
    }

    // 基準時刻（最初の参加者のenteredAtを使用、または現在時刻）
    const baseTime = participants[0].enteredAt || new Date()
    const baseTimestamp = new Date(baseTime).getTime()

    let updateCount = 0

    // 各参加者のenteredAtを1msずつずらして更新
    for (let i = 0; i < participants.length; i++) {
      const participant = participants[i]
      const newEnteredAt = new Date(baseTimestamp + i) // 1msずつずらす

      try {
        await prisma.participant.update({
          where: { id: participant.id },
          data: { enteredAt: newEnteredAt },
        })

        updateCount++
        if (i < 5 || i >= participants.length - 5) {
          console.log(
            `[${i + 1}/${participants.length}] ✅ ${participant.user.name} - ${newEnteredAt.toISOString()}`
          )
        } else if (i === 5) {
          console.log('   ...')
        }
      } catch (error) {
        console.error(`[${i + 1}/${participants.length}] ❌ ${participant.user.name} - ${error.message}`)
      }
    }

    console.log(`\n=== 完了 ===\n`)
    console.log(`更新された参加者: ${updateCount}人`)
    console.log('')
  } catch (error) {
    console.error('❌ エラー:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixParticipantEntryTimes()

