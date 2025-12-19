// パスワードをURLエンコードするスクリプト
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function encodePassword() {
  try {
    const password = await question('\nパスワードを入力してください: ')
    
    // URLエンコード（特に@を%40に変換）
    const encodedPassword = encodeURIComponent(password)
    
    console.log('\n=== URLエンコード結果 ===')
    console.log('')
    console.log('元のパスワード:', password)
    console.log('エンコード後:', encodedPassword)
    console.log('')
    console.log('DATABASE_URLの例:')
    console.log(`postgresql://postgres:${encodedPassword}@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true`)
    console.log('')
    console.log('注意: @ は %40 に変換されます')
    console.log('')
  } catch (error) {
    console.error('❌ エラー:', error)
  } finally {
    rl.close()
  }
}

encodePassword()

