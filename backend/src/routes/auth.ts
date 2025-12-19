import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = express.Router()
const prisma = new PrismaClient()

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'すべての項目を入力してください' })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(400).json({ message: 'このメールアドレスは既に登録されています' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    })

    res.json({
      user: {
        ...user,
        role: user.role.toLowerCase() as 'user' | 'organizer' | 'admin',
      },
      token,
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: '登録に失敗しました' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'メールアドレスとパスワードを入力してください' })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return res.status(401).json({ message: 'メールアドレスまたはパスワードが正しくありません' })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({ message: 'メールアドレスまたはパスワードが正しくありません' })
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.toLowerCase() as 'user' | 'organizer' | 'admin',
        createdAt: user.createdAt,
      },
      token,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'ログインに失敗しました' })
  }
})

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: '認証が必要です' })
    }

    res.json({
      ...req.user,
      role: req.user.role.toLowerCase() as 'user' | 'organizer' | 'admin',
    })
  } catch (error) {
    console.error('Get current user error:', error)
    res.status(500).json({ message: 'ユーザー情報の取得に失敗しました' })
  }
})

export default router

