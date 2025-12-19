// テストユーザーを作成するスクリプト
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function createTestUsers() {
  try {
    const testUsers = [
      {
        email: 'test1@example.com',
        name: 'テストユーザー1',
        password: '1234',
        role: 'USER',
      },
      {
        email: 'test2@example.com',
        name: 'テストユーザー2',
        password: '1234',
        role: 'USER',
      },
      {
        email: 'test3@example.com',
        name: 'テストユーザー3',
        password: '1234',
        role: 'USER',
      },
    ]

    for (const userData of testUsers) {
      // 既存ユーザーをチェック
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      })

      if (existingUser) {
        console.log(`ユーザー "${userData.email}" は既に存在します`)
        continue
      }

      // パスワードをハッシュ化
      const hashedPassword = await bcrypt.hash(userData.password, 10)

      // ユーザーを作成
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          password: hashedPassword,
          role: userData.role,
        },
      })

      console.log(`ユーザーを作成しました: ${user.name} (${user.email})`)
    }

    console.log('\nテストユーザー作成完了！')
    console.log('ログイン情報:')
    testUsers.forEach((user) => {
      console.log(`  メール: ${user.email}, パスワード: ${user.password}`)
    })
  } catch (error) {
    console.error('エラー:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUsers()

