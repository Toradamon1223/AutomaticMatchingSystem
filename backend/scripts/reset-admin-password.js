// Adminユーザーのパスワードをリセットするスクリプト
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const readline = require('readline')

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function resetAdminPassword() {
  try {
    // Adminユーザーを取得
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (adminUsers.length === 0) {
      console.log('❌ Adminユーザーが見つかりません')
      return
    }

    console.log('\n=== Adminユーザー一覧 ===')
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`)
    })

    let selectedUser
    if (adminUsers.length === 1) {
      selectedUser = adminUsers[0]
      console.log(`\n✅ ユーザー "${selectedUser.name}" (${selectedUser.email}) を選択しました`)
    } else {
      const answer = await question('\nパスワードをリセットするユーザーの番号を入力してください: ')
      const index = parseInt(answer) - 1
      if (index < 0 || index >= adminUsers.length) {
        console.log('❌ 無効な番号です')
        return
      }
      selectedUser = adminUsers[index]
    }

    // 新しいパスワードを入力
    const newPassword = await question('\n新しいパスワードを入力してください: ')
    if (!newPassword || newPassword.length < 4) {
      console.log('❌ パスワードは4文字以上である必要があります')
      return
    }

    const confirmPassword = await question('パスワードを確認してください: ')
    if (newPassword !== confirmPassword) {
      console.log('❌ パスワードが一致しません')
      return
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // パスワードを更新
    const updatedUser = await prisma.user.update({
      where: { id: selectedUser.id },
      data: { password: hashedPassword },
    })

    console.log(`\n✅ パスワードをリセットしました！`)
    console.log(`   ユーザー: ${updatedUser.name} (${updatedUser.email})`)
    console.log(`   新しいパスワード: ${newPassword}`)
  } catch (error) {
    console.error('❌ エラー:', error)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

resetAdminPassword()

