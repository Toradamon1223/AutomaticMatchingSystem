// ネットワーク接続をテストするスクリプト
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

async function testNetworkConnection() {
  console.log('\n=== ネットワーク接続テスト ===\n')

  const hosts = [
    'aws-1-ap-northeast-1.pooler.supabase.com',
    'db.wzktmwufngrdbuxnorqd.supabase.co',
  ]

  const ports = [5001, 5432, 6543]

  for (const host of hosts) {
    console.log(`\nホスト: ${host}`)
    console.log('─'.repeat(50))

    // Pingテスト
    try {
      const { stdout } = await execAsync(`ping -c 3 ${host} 2>&1 || ping -n 3 ${host} 2>&1`)
      console.log('✅ Ping成功')
      console.log(stdout.split('\n').slice(0, 3).join('\n'))
    } catch (error) {
      console.log('❌ Ping失敗')
      console.log(error.message.split('\n').slice(0, 2).join('\n'))
    }

    // ポート接続テスト
    for (const port of ports) {
      try {
        const { stdout } = await execAsync(`timeout 5 bash -c "</dev/tcp/${host}/${port}" 2>&1 || nc -zv -w 5 ${host} ${port} 2>&1 || echo "接続失敗"`)
        if (stdout.includes('succeeded') || stdout.includes('open') || stdout.includes('Connected')) {
          console.log(`✅ ポート ${port}: 接続可能`)
        } else {
          console.log(`❌ ポート ${port}: 接続不可`)
        }
      } catch (error) {
        console.log(`❌ ポート ${port}: 接続不可`)
      }
    }
  }

  console.log('\n=== 推奨される確認方法 ===\n')
  console.log('1. Supabaseダッシュボードでプロジェクトの状態を確認')
  console.log('2. サーバーのファイアウォール設定を確認')
  console.log('3. セキュリティグループでポート5001, 5432, 6543が許可されているか確認')
  console.log('4. SupabaseのIPアドレス許可リストを確認')
  console.log('')
}

testNetworkConnection().catch(console.error)

