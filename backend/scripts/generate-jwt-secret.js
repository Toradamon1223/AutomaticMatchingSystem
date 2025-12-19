// JWT_SECRETを生成するスクリプト
const crypto = require('crypto')

// 64バイト（512ビット）のランダムな16進数文字列を生成
const jwtSecret = crypto.randomBytes(64).toString('hex')

console.log('\n=== JWT_SECRET生成 ===')
console.log('')
console.log('以下の文字列を.envファイルのJWT_SECRETに設定してください:')
console.log('')
console.log(jwtSecret)
console.log('')
console.log('例:')
console.log(`JWT_SECRET="${jwtSecret}"`)
console.log('')

