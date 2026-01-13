// 全ユーザーを指定した大会にエントリーさせるスクリプト
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function entryAllUsersToTournament() {
  try {
    console.log('\n=== 全ユーザーを大会にエントリー開始 ===\n')

    // 大会名で大会を検索（部分一致も可）
    const tournamentName = 'めっちゃいい大会'
    const tournament = await prisma.tournament.findFirst({
      where: {
        name: {
          contains: tournamentName,
        },
      },
      include: {
        participants: {
          where: {
            cancelledAt: null,
          },
        },
      },
    })

    if (!tournament) {
      console.error(`❌ 大会 "${tournamentName}" が見つかりません`)
      console.log('\n利用可能な大会一覧:')
      const allTournaments = await prisma.tournament.findMany({
        select: {
          id: true,
          name: true,
          status: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      })
      allTournaments.forEach((t) => {
        console.log(`   - ${t.name} (ID: ${t.id}, Status: ${t.status})`)
      })
      return
    }

    console.log(`✅ 大会を見つけました: ${tournament.name} (ID: ${tournament.id})`)
    console.log(`   現在の参加者数: ${tournament.participants.length}人`)
    if (tournament.capacity) {
      console.log(`   定員: ${tournament.capacity}人`)
    }
    console.log('')

    // 全ユーザーを取得
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    console.log(`全ユーザー数: ${allUsers.length}人\n`)

    let entryCount = 0
    let skipCount = 0
    let errorCount = 0

    // バッチサイズ
    const batchSize = 20

    for (let i = 0; i < allUsers.length; i += batchSize) {
      const batch = allUsers.slice(i, i + batchSize)
      const startNum = i + 1
      const endNum = Math.min(i + batchSize, allUsers.length)

      // 既存の参加者を取得
      const existingParticipants = await prisma.participant.findMany({
        where: {
          tournamentId: tournament.id,
          userId: {
            in: batch.map((u) => u.id),
          },
          cancelledAt: null,
        },
        select: {
          userId: true,
        },
      })

      const existingUserIds = new Set(existingParticipants.map((p) => p.userId))

      // エントリーするユーザーをフィルタリング
      const usersToEntry = batch.filter((user) => !existingUserIds.has(user.id))

      if (usersToEntry.length > 0) {
        // 現在の参加者数を取得
        const currentParticipants = await prisma.participant.findMany({
          where: {
            tournamentId: tournament.id,
            cancelledAt: null,
          },
        })

        const confirmedCount = currentParticipants.filter((p) => !p.isWaitlist).length
        const isWaitlist = tournament.capacity !== null && confirmedCount >= tournament.capacity

        // バッチでエントリー作成（enteredAtを少しずつずらす）
        const baseTime = new Date()
        const participantsData = usersToEntry.map((user, idx) => ({
          tournamentId: tournament.id,
          userId: user.id,
          enteredAt: new Date(baseTime.getTime() + idx), // ミリ秒単位で1msずつずらす
          isWaitlist,
        }))

        try {
          await prisma.participant.createMany({
            data: participantsData,
            skipDuplicates: true,
          })

          entryCount += participantsData.length
          console.log(
            `[${startNum}-${endNum}/${allUsers.length}] ✅ ${participantsData.length}人をエントリーしました${isWaitlist ? ' (キャンセル待ち)' : ''}`
          )

          // 最初の5人を表示
          participantsData.slice(0, 5).forEach((_, idx) => {
            const user = usersToEntry[idx]
            console.log(`   - ${user.name} (${user.email})`)
          })
          if (participantsData.length > 5) {
            console.log(`   ... 他 ${participantsData.length - 5}人`)
          }
        } catch (error) {
          console.error(`[${startNum}-${endNum}] ❌ バッチエラー: ${error.message}`)
          errorCount += usersToEntry.length
        }
      }

      // スキップされたユーザー
      const skippedUsers = batch.filter((user) => existingUserIds.has(user.id))
      if (skippedUsers.length > 0) {
        skipCount += skippedUsers.length
        console.log(`[${startNum}-${endNum}] ⏭️  ${skippedUsers.length}人は既にエントリー済み`)
      }

      console.log(`\n--- 進捗: ${endNum}/${allUsers.length} (エントリー: ${entryCount}, スキップ: ${skipCount}, エラー: ${errorCount}) ---\n`)

      // 接続を少し待機
      if (endNum < allUsers.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    // 最終結果を取得
    const finalParticipants = await prisma.participant.findMany({
      where: {
        tournamentId: tournament.id,
        cancelledAt: null,
      },
    })

    const finalConfirmedCount = finalParticipants.filter((p) => !p.isWaitlist).length
    const finalWaitlistCount = finalParticipants.filter((p) => p.isWaitlist).length

    console.log('\n=== 完了 ===\n')
    console.log(`エントリーしたユーザー: ${entryCount}人`)
    console.log(`スキップしたユーザー: ${skipCount}人（既にエントリー済み）`)
    console.log(`エラー: ${errorCount}人`)
    console.log(`\n最終的な参加者数:`)
    console.log(`   定員内: ${finalConfirmedCount}人`)
    console.log(`   キャンセル待ち: ${finalWaitlistCount}人`)
    console.log(`   合計: ${finalParticipants.length}人`)
    console.log('')
  } catch (error) {
    console.error('❌ エラー:', error)
  } finally {
    await prisma.$disconnect()
  }
}

entryAllUsersToTournament()

