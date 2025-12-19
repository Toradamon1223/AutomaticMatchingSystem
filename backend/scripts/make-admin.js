// 最初のユーザーを管理者にするスクリプト
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function makeAdmin() {
  try {
    // 最初のユーザーを取得
    const firstUser = await prisma.user.findFirst({
      orderBy: {
        createdAt: 'asc',
      },
    })

    if (!firstUser) {
      console.log('ユーザーが見つかりません')
      return
    }

    // 管理者に変更
    const updatedUser = await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: 'ADMIN' },
    })

    console.log(`ユーザー "${updatedUser.name}" (${updatedUser.email}) を管理者に変更しました`)
  } catch (error) {
    console.error('エラー:', error)
  } finally {
    await prisma.$disconnect()
  }
}

makeAdmin()

