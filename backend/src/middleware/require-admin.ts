/**
 * middleware/require-admin.ts — Admin RBAC 鉴权中间件
 *
 * 用于保护所有 /api/v1/admin/* 和 /api/admin/* 路由
 * 从 Authorization header 解析 admin token（JWT），校验角色权限
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '../routes/admin-auth.js'

// 需要超级管理员权限的路由模式
const SUPERADMIN_ONLY = [
  '/api/v1/admin/admins',
  '/api/v1/admin/provider-keys',
]

export interface AdminUser {
  username: string
  role: string
}

/**
 * 提取并验证 admin token
 */
export function extractAdmin(request: FastifyRequest): AdminUser | null {
  const auth = request.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null

  const token = auth.slice(7).trim()
  if (!token) return null

  try {
    return verifyToken(token)
  } catch {
    return null
  }
}

/**
 * 通用 admin 鉴权（允许 admin 和 superadmin）
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const admin = extractAdmin(request)
  if (!admin) {
    reply.status(401).send({ error: '未授权，需要管理员登录' })
    return
  }

  const url = request.url
  const needsSuperAdmin = SUPERADMIN_ONLY.some(prefix => url.startsWith(prefix))
  if (needsSuperAdmin && admin.role !== 'superadmin') {
    reply.status(403).send({ error: '仅超级管理员可执行此操作' })
    return
  }
}

/**
 * 仅超级管理员
 */
export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const admin = extractAdmin(request)
  if (!admin) {
    reply.status(401).send({ error: '未授权，需要管理员登录' })
    return
  }
  if (admin.role !== 'superadmin') {
    reply.status(403).send({ error: '仅超级管理员可执行此操作' })
    return
  }
}
