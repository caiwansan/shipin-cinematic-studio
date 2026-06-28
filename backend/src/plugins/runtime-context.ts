/**
 * plugins/runtime-context.ts — Fastify plugin
 *
 * 在每个请求入口创建 RuntimeContext（Execution Envelope）
 * 必须在 auth 插件之后注册（需要 userId）
 *
 * Phase 3A: 集成 RuntimeObserver — context 创建/更新时记录事件
 */

import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { createContext } from '../services/runtime-context.js'
import { runtimeObserver } from '../services/runtime-observer.service.js'

export default fp(async function runtimeContextPlugin(fastify: FastifyInstance) {
  // 公开接口白名单（不需要登录即可访问）
  const PUBLIC_PATHS = [
    '/api/v1/system/health',
    '/api/v1/system/version',
    '/api/auth/register',
    '/api/auth/login',
    '/api/captcha',
    '/api/sms',
    '/',
  ]

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0]  // 去掉 query params
    if (PUBLIC_PATHS.some(p => url.startsWith(p))) return

    const userId = (request.user as any)?.id
    if (!userId) {
      reply.status(401).send({ error: '未授权', message: '请先登录后再使用 AI 生成功能' })
      return reply
    }
    const projectId = (request.params as any)?.id || (request.query as any)?.projectId

    const ctx = createContext({
      userId,
      projectId,
      stage: 'init',
    })

    // Phase 3A: Observer — context 创建事件
    runtimeObserver.recordEvent('context.created', ctx, {
      url: request.url,
      method: request.method,
      projectId,
    })

    ;(request as any).__runtimeCtx = ctx
  })

  // preHandler 确保 context 在 handler 中可用
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    const ctx = (request as any).__runtimeCtx
    if (ctx) {
      const userId = (request.user as any)?.id
      if (userId && ctx.userId === 'anonymous') {
        ctx.userId = userId
        // Phase 3A: Observer — provider 附着事件（意味 auth 后 context 完成）
        runtimeObserver.recordEvent('context.provider_attached', ctx, { userId })
      }
    }
  })
})

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

