const dotenv = require('dotenv')
const { PrismaClient } = require('@prisma/client')

dotenv.config()

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('Supabase keepalive: ok')
  } catch (error) {
    console.error('Supabase keepalive failed:', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()


