import express from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'

const router = express.Router()

// 管理者のみアクセス可能
router.use(authenticate)
router.use(requireRole('admin'))

// ユーザー一覧取得
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.json(users)
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ message: 'ユーザー一覧の取得に失敗しました' })
  }
})

// ユーザー役割更新
router.patch('/users/:id/role', async (req: AuthRequest, res) => {
  try {
    const { role } = req.body

    if (!['USER', 'ORGANIZER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: '無効な役割です' })
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: role as any },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    res.json(user)
  } catch (error) {
    console.error('Update user role error:', error)
    res.status(500).json({ message: '役割の更新に失敗しました' })
  }
})

export default router

