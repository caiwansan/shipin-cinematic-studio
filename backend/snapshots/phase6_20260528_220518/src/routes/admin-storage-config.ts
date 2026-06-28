import type { ApiResponse } from '../contracts/api/base.js';
/**
 * 后台 COS 存储配置管理 API
 * GET    /api/admin/storage-config     — 获取所有存储配置
 * POST   /api/admin/storage-config     — 新增或更新存储配置
 * DELETE /api/admin/storage-config/:id — 删除存储配置
 * POST   /api/admin/storage-config/:id/default — 设为默认
 * POST   /api/admin/storage-config/:id/toggle  — 启用/禁用
 */
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// AES-GCM 加密/解密 (与 user-model-config.ts 保持一致)
const ALGORITHM = 'aes-256-gcm'

function encryptKey(plaintext: string): string {
  const key = Buffer.from(process.env.CRYPTO_ENCRYPTION_KEY || '', 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted + ':' + cipher.getAuthTag().toString('hex')
}

function decryptKey(ciphertext: string): string {
  try {
    const key = Buffer.from(process.env.CRYPTO_ENCRYPTION_KEY || '', 'hex')
    const parts = ciphertext.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    const authTag = Buffer.from(parts[2], 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return ciphertext // fallback: 返回原文（未加密的旧数据）
  }
}

export default async function adminStorageConfigRoutes(fastify: FastifyInstance) {
  // 获取所有存储配置
  fastify.get('/api/admin/storage-config', async (request: any, reply: any) => {
    try {
      const auth = request.headers.authorization
      if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

      const configs = await prisma.storageConfig.findMany({ orderBy: { createdAt: 'desc' } })
      const serialized = configs.map(c => ({
        ...c,
        secretKey: c.secretKey ? '••••' + c.secretKey.slice(-4) : '',
      }))
      return { success: true, data: serialized } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // 新增/更新存储配置
  fastify.post('/api/admin/storage-config', async (request: any, reply: any) => {
    try {
      const auth = request.headers.authorization
      if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

      const { id, name, type, endpoint, region, accessKey, secretKey, bucket, isDefault, enabled, remark } = request.body as any

      if (!name || !endpoint || !accessKey || !secretKey) {
        return reply.status(400).send({ success: false, error: 'name, endpoint, accessKey, secretKey 为必填' })
      }

      const encryptedSecret = encryptKey(secretKey)

      if (id) {
        // 更新
        const existing = await prisma.storageConfig.findUnique({ where: { id } })
        if (!existing) return reply.status(404).send({ success: false, error: '配置不存在' })

        const data: any = { name, type: type || 'minio', endpoint, region, accessKey, bucket: bucket || 'aigc-assets', isDefault: !!isDefault, enabled: enabled !== false, remark }
        data.secretKey = secretKey?.startsWith('••••') ? existing.secretKey : encryptedSecret

        const updated = await prisma.storageConfig.update({ where: { id }, data })
        return { success: true, data: { ...updated, secretKey: '••••' + updated.secretKey.slice(-4) } } satisfies ApiResponse<unknown>;

      } else {
        // 新增
        if (isDefault) {
          await prisma.storageConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
        }
        const created = await prisma.storageConfig.create({
          data: { name, type: type || 'minio', endpoint, region, accessKey, secretKey: encryptedSecret, bucket: bucket || 'aigc-assets', isDefault: !!isDefault, enabled: enabled !== false, remark },
        })
        return { success: true, data: { ...created, secretKey: '••••' + created.secretKey.slice(-4) } } satisfies ApiResponse<unknown>;

      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // 删除配置
  fastify.delete('/api/admin/storage-config/:id', async (request: any, reply: any) => {
    try {
      const auth = request.headers.authorization
      if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

      const { id } = request.params as any
      await prisma.storageConfig.delete({ where: { id } })
      return { success: true } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // 设为默认
  fastify.post('/api/admin/storage-config/:id/default', async (request: any, reply: any) => {
    try {
      const auth = request.headers.authorization
      if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

      const { id } = request.params as any
      await prisma.storageConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      await prisma.storageConfig.update({ where: { id }, data: { isDefault: true } })
      return { success: true } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // 启用/禁用
  fastify.post('/api/admin/storage-config/:id/toggle', async (request: any, reply: any) => {
    try {
      const auth = request.headers.authorization
      if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

      const { id } = request.params as any
      const config = await prisma.storageConfig.findUnique({ where: { id } })
      if (!config) return reply.status(404).send({ success: false, error: '配置不存在' })

      const updated = await prisma.storageConfig.update({ where: { id }, data: { enabled: !config.enabled } })
      return { success: true, data: { enabled: updated.enabled } } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
