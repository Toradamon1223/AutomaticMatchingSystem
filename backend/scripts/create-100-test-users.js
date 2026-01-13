// 100人のテストユーザーを作成するスクリプト
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

// 接続プールを適切に管理するため、PrismaClientを1つだけ使用
const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function create100TestUsers() {
  try {
    console.log('\n=== 100人のテストユーザー作成開始 ===\n')
    console.log('注意: 既存のユーザーは自動的にスキップされます\n')

    const password = '1234' // 全員同じパスワード
    const hashedPassword = await bcrypt.hash(password, 10)

    let createdCount = 0

    // バッチサイズ（一度に作成するユーザー数）
    const batchSize = 20

    // 全ユーザーデータを準備
    const allUsers = []
    for (let i = 1; i <= 100; i++) {
      allUsers.push({
        email: `test${i}@example.com`,
        name: `テストユーザー${i}`,
        password: hashedPassword,
        role: 'USER',
      })
    }

    // バッチで処理
    for (let i = 0; i < allUsers.length; i += batchSize) {
      const batch = allUsers.slice(i, i + batchSize)
      const startNum = i + 1
      const endNum = Math.min(i + batchSize, 100)

      try {
        // バッチで一括作成（重複は自動スキップ）
        const result = await prisma.user.createMany({
          data: batch,
          skipDuplicates: true, // 重複をスキップ
        })

        createdCount += result.count
        console.log(`[${startNum}-${endNum}/100] ✅ ${result.count}人のユーザーを作成しました`)

        // 作成されたユーザーを表示
        if (result.count > 0) {
          batch.slice(0, Math.min(5, result.count)).forEach((userData, idx) => {
            const userNum = startNum + idx
            console.log(`   - ${userData.name} (${userData.email})`)
          })
          if (result.count > 5) {
            console.log(`   ... 他 ${result.count - 5}人`)
          }
        }
      } catch (error) {
        console.error(`[${startNum}-${endNum}] ❌ バッチエラー: ${error.message}`)
        // エラーが発生した場合、少し待ってから再試行
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // 進捗表示
      console.log(`\n--- 進捗: ${endNum}/100 (作成済み: ${createdCount}人) ---\n`)

      // 接続を少し待機（接続プールの負荷を軽減）
      if (endNum < 100) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }

    console.log('\n=== 完了 ===\n')
    console.log(`作成されたユーザー: ${createdCount}人`)
    console.log(`スキップされたユーザー: ${100 - createdCount}人（既に存在するユーザー）`)
    console.log(`\nログイン情報:`)
    console.log(`  メール: test1@example.com ～ test100@example.com`)
    console.log(`  パスワード: ${password}`)
    console.log('')
  } catch (error) {
    console.error('❌ エラー:', error)
  } finally {
    await prisma.$disconnect()
  }
}

create100TestUsers()

