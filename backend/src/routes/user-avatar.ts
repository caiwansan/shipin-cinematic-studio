import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { resolve } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';

const UPLOAD_DIR = '/root/shipin-cinematic-studio/backend/public/uploads'
const BASE_URL = '/api/v1/uploads'
const PUBLIC_HOST = 'https://aigc.fushtn.com'

// ============================================
// MEMBER-CENTER-02 用户头像
// ============================================

export default async function userAvatarRoutes(fastify: FastifyInstance) {
  // POST /api/user/avatar — 上传/更换头像（multipart: file）
  fastify.post('/api/user/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id || user.userId
    if (!userId) {
      return reply.status(401).send({ error: '用户身份无效，请重新登录' })
    }

    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: '未上传文件' })
    }

    const buffer = await data.toBuffer()
    // 头像大小限制：5MB
    const MAX_SIZE = 5 * 1024 * 1024
    if (buffer.length > MAX_SIZE) {
      return reply.status(413).send({ error: `头像文件过大（最大 5MB），当前 ${(buffer.length / 1024 / 1024).toFixed(1)}MB` })
    }

    const ext = data.filename?.split('.').pop()?.toLowerCase() || 'png'
    const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp']
    if (!allowedExts.includes(ext)) {
      return reply.status(400).send({ error: `不支持的图片格式: .${ext}，支持: ${allowedExts.join(', ')}` })
    }

    const filename = `avatar_${userId.slice(0, 8)}_${randomUUID().slice(0, 8)}.${ext}`
    const filepath = resolve(UPLOAD_DIR, filename)
    await mkdir(UPLOAD_DIR, { recursive: true })
    await writeFile(filepath, buffer)

    const publicUrl = `${PUBLIC_HOST}${BASE_URL}/${filename}`

    // 更新 User.avatarUrl（全站生效：导航栏/会员中心/聊天/社区）
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
    })

    return toApiResponse({ success: true, avatarUrl: publicUrl, message: '头像更新成功' })
  })

  // DELETE /api/user/avatar — 移除头像（恢复默认首字母头像）
  fastify.delete('/api/user/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id || user.userId
    if (!userId) {
      return reply.status(401).send({ error: '用户身份无效，请重新登录' })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    })

    return toApiResponse({ success: true, avatarUrl: null, message: '已恢复默认头像' })
  })
}
