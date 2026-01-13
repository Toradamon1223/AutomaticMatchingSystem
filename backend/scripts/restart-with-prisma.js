#!/usr/bin/env node
// バックエンドサーバーを再起動し、Prisma Clientを再生成するスクリプト（Node.js版）

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function execCommand(command, description) {
  try {
    log(description, colors.yellow)
    execSync(command, { stdio: 'inherit', cwd: __dirname + '/..' })
    log(`✅ ${description}が完了しました`, colors.green)
    return true
  } catch (error) {
    log(`❌ ${description}に失敗しました`, colors.red)
    return false
  }
}

function checkPM2() {
  try {
    execSync('pm2 --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function restartPM2() {
  const pm2Names = ['tcg-backend', 'backend', 'all']
  
  for (const name of pm2Names) {
    try {
      execSync(`pm2 restart ${name}`, { stdio: 'ignore', cwd: __dirname + '/..' })
      log(`✅ PM2でサーバーを再起動しました (${name})`, colors.green)
      return true
    } catch {
      // 次の名前を試す
    }
  }
  
  return false
}

// メイン処理
log('========================================', colors.cyan)
log('バックエンドサーバー再起動 & Prisma Client再生成', colors.cyan)
log('========================================', colors.cyan)
log('')

const backendDir = path.resolve(__dirname, '..')
process.chdir(backendDir)

// 1. Prisma Clientを再生成
if (!execCommand('npm run prisma:generate', '[1/3] Prisma Clientを再生成中...')) {
  process.exit(1)
}

log('')

// 2. TypeScriptをビルド
if (!execCommand('npm run build', '[2/3] TypeScriptをビルド中...')) {
  process.exit(1)
}

log('')

// 3. PM2でサーバーを再起動
log('[3/3] PM2でサーバーを再起動中...', colors.yellow)
if (checkPM2()) {
  if (restartPM2()) {
    // 成功
  } else {
    log('⚠️  PM2の再起動に失敗しました（サーバーが起動していない可能性があります）', colors.yellow)
    log('    手動で起動してください: pm2 start dist/index.js --name tcg-backend', colors.yellow)
  }
} else {
  log('⚠️  PM2が見つかりません。手動でサーバーを再起動してください。', colors.yellow)
  log('    開発モード: npm run dev', colors.yellow)
  log('    本番モード: npm start', colors.yellow)
}

log('')
log('========================================', colors.cyan)
log('✅ 完了しました！', colors.green)
log('========================================', colors.cyan)

