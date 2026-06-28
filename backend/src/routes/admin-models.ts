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
  // GET /api/admin/provider-keys — 废弃路由，无需认证直接返回空（防止无 token 时前端请求拖垮限流）
  fastify.get('/api/admin/provider-keys', async (_request, reply) => {
    return reply.send({
      success: true,
      providers: [],
      message: '此路由已废弃',
    })
  })

  // PUT /api/admin/provider-keys/:provider — 不再支持，返回提示
  fastify.put('/api/admin/provider-keys/:provider', async (request, reply) => {
    return reply.status(400).send({
      success: false,
      error: '后台不再管理全局 API Key。用户的 API Key 由前端自行配置，加密保存在 UserModelConfig 表。',
    })
  })
}
