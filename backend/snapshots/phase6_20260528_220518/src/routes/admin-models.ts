import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { verifyToken } from './admin-auth.js'

/**
 * admin-models.ts
 *
 * 后台大模型供应商管理路由。
 *
 * 架构说明：
 * - 用户的 API Key 只保存在 UserModelConfig 表，AES-256-GCM 加密存储
 *   （详见 user-model-config.ts + crypto.service.ts）
 * - 后台不保存/管理用户的 API Key
 * - 后台只控制全局启用/禁用供应商（toggle 在 admin-global-config.ts 中）
 *
 * 本文件保留 provider-keys 路由仅为向后兼容，返回提示信息。
 */

export default async function adminModelRoutes(fastify: FastifyInstance) {
  // GET /api/v1/admin/provider-keys — 返回提示（系统不再管理全局 API Key）
  fastify.get('/api/v1/admin/provider-keys', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    return {
      success: true,
      providers: [],
      message: 'API Key 由每个用户在前端自行配置，后台不保存用户 Key。请使用 /api/v1/admin/global-models 管理全局供应商开关。',
    }
  })

  // PUT /api/v1/admin/provider-keys/:provider — 不再支持，返回提示
  fastify.put('/api/v1/admin/provider-keys/:provider', async (request, reply) => {
    return reply.status(400).send({
      success: false,
      error: '后台不再管理全局 API Key。用户的 API Key 由前端自行配置，加密保存在 UserModelConfig 表。',
    })
  })
}
