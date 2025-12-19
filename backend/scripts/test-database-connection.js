// データベース接続をテストするスクリプト
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })

  try {
    console.log('\n=== データベース接続テスト ===\n')
    
    // 環境変数の確認（パスワード部分は隠す）
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      console.log('❌ DATABASE_URLが設定されていません')
      console.log('   .envファイルを確認してください')
      return
    }

    // パスワード部分を隠して表示
    const maskedUrl = dbUrl.replace(/:[^@]+@/, ':***@')
    console.log('DATABASE_URL:', maskedUrl)
    console.log('')

    // 接続テスト
    console.log('接続を試みています...')
    await prisma.$connect()
    console.log('✅ 接続成功！\n')

    // 簡単なクエリを実行
    console.log('クエリをテストしています...')
    const userCount = await prisma.user.count()
    console.log(`✅ ユーザー数: ${userCount}\n`)

    // Adminユーザーを確認
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    if (adminUsers.length > 0) {
      console.log('✅ Adminユーザーが見つかりました:')
      adminUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`)
      })
    } else {
      console.log('⚠️  Adminユーザーが見つかりませんでした')
    }

  } catch (error) {
    console.log('\n❌ 接続エラー:')
    console.log('   エラーメッセージ:', error.message)
    console.log('   エラーコード:', error.errorCode || 'なし')
    console.log('')
    console.log('よくある原因:')
    console.log('   1. DATABASE_URLが正しく設定されていない')
    console.log('   2. パスワードに@が含まれていてエンコードされていない')
    console.log('   3. ?pgbouncer=trueが追加されていない')
    console.log('   4. ネットワークの問題（ファイアウォールなど）')
    console.log('   5. Supabaseプロジェクトが停止している')
    console.log('')
    console.log('確認方法:')
    console.log('   - .envファイルのDATABASE_URLを確認')
    console.log('   - Supabaseダッシュボードでプロジェクトの状態を確認')
    console.log('   - サーバーからSupabaseへの接続を確認（pingやtelnet）')
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()

