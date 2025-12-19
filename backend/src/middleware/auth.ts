import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface AuthRequest extends Request {
  userId?: string
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ message: '認証トークンがありません' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      userId: string
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    if (!user) {
      return res.status(401).json({ message: 'ユーザーが見つかりません' })
    }

    req.userId = user.id
    req.user = {
      ...user,
      role: user.role.toLowerCase(),
    }
    next()
  } catch (error) {
    return res.status(401).json({ message: '無効なトークンです' })
  }
}

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: '認証が必要です' })
    }

    if (!roles.includes(req.user.role.toLowerCase())) {
      return res.status(403).json({ message: '権限がありません' })
    }

    next()
  }
}

