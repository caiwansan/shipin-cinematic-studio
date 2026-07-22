import type { ApiResponse } from '../contracts/api/base.js'
import { FastifyInstance } from 'fastify'
import { requireAdmin, requireSuperAdmin } from '../middleware/require-admin.js'
import { prisma } from '../utils/index.js'

function encryptKeyLocal(plaintext: string): string {
  return plaintext
}

function decryptKeyLocal(ciphertext: string): string {
  return ciphertext
}

export default async function adminStorageConfigRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/storage-config', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const configs = await prisma.storageConfig.findMany({ orderBy: { createdAt: 'desc' } })
      const serialized = configs.map(c => ({
        ...c,
        secretKey: c.secretKey ? '••••' + c.secretKey.slice(-4) : '',
      }))
      return { success: true, data: serialized } satisfies ApiResponse<unknown>
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/admin/storage-config', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    try {
      const { id, name, type, endpoint, region, accessKey, secretKey, bucket, isDefault, enabled, remark } = request.body as any

      if (!name || !endpoint || !accessKey || !secretKey) {
        return reply.status(400).send({ success: false, error: 'name, endpoint, accessKey, secretKey 为必填' })
      }

      const encryptedSecret = encryptKeyLocal(secretKey)

      if (id) {
        const existing = await prisma.storageConfig.findUnique({ where: { id } })
        if (!existing) return reply.status(404).send({ success: false, error: '配置不存在' })

        const data: any = { name, type: type || 'minio', endpoint, region, accessKey, bucket: bucket || 'aigc-assets', isDefault: !!isDefault, enabled: enabled !== false, remark }
        data.secretKey = secretKey?.startsWith('••••') ? existing.secretKey : encryptedSecret

        const updated = await prisma.storageConfig.update({ where: { id }, data })
        return { success: true, data: { ...updated, secretKey: '••••' + updated.secretKey.slice(-4) } } satisfies ApiResponse<unknown>
      } else {
        if (isDefault) {
          await prisma.storageConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
        }
        const created = await prisma.storageConfig.create({
          data: { name, type: type || 'minio', endpoint, region, accessKey, secretKey: encryptedSecret, bucket: bucket || 'aigc-assets', isDefault: !!isDefault, enabled: enabled !== false, remark },
        })
        return { success: true, data: { ...created, secretKey: '••••' + created.secretKey.slice(-4) } } satisfies ApiResponse<unknown>
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/admin/storage-config/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      await prisma.storageConfig.delete({ where: { id } })
      return { success: true, data: {} } satisfies ApiResponse<unknown>
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/admin/storage-config/:id/default', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      await prisma.storageConfig.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      await prisma.storageConfig.update({ where: { id }, data: { isDefault: true } })
      return { success: true, data: {} } satisfies ApiResponse<unknown>
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/admin/storage-config/:id/toggle', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const config = await prisma.storageConfig.findUnique({ where: { id } })
      if (!config) return reply.status(404).send({ success: false, error: '配置不存在' })

      const updated = await prisma.storageConfig.update({ where: { id }, data: { enabled: !config.enabled } })
      return { success: true, data: { enabled: updated.enabled } } satisfies ApiResponse<unknown>
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
