/**
 * routes/platform/admin-platform-runtime.route.ts — Admin Platform Runtime API
 *
 * Hybrid AI Runtime Architecture:
 *   管理员可在此维护 Platform Provider Pool。
 *   普通用户不可见。
 *
 * 注意：platform_provider_config 表不在 Prisma schema 中定义，
 *       所有查询使用 raw SQL 以避免运行时错误。
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { encryptKey } from '../../services/crypto.service.js'
import { platformRuntimeService } from '../../runtime/platform/platform-runtime.service.js'
import { platformCompatibilityService } from '../../runtime/platform/compatibility.service.js'

export default async function adminPlatformRuntimeRoutes(fastify: FastifyInstance) {
  // GET /api/admin/platform-runtime/providers — 获取所有 Provider 状态
  fastify.get('/api/admin/platform-runtime/providers', async (_req, reply) => {
    try {
      const configs: any[] = await prisma.$queryRawUnsafe(
        'SELECT id, provider, "baseUrl" as "baseUrl", model, is_enabled as "isEnabled", health_status as "healthStatus", last_health_check_at as "lastHealthCheckAt", daily_quota as "dailyQuota", daily_used as "dailyUsed", cost_per_call as "costPerCall" FROM platform_provider_config ORDER BY health_status ASC, provider ASC'
      )

      const data = configs.map(c => ({
        id: c.id,
        provider: c.provider,
        isEnabled: c.isEnabled,
        model: c.model,
        baseUrl: c.baseUrl,
        healthStatus: c.healthStatus,
        lastHealthCheckAt: c.lastHealthCheckAt ? new Date(c.lastHealthCheckAt).toISOString() : null,
        dailyQuota: c.dailyQuota,
        dailyUsed: c.dailyUsed,
        costPerCall: c.costPerCall,
      }))

      return reply.send({ success: true, data })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/admin/platform-runtime/providers — 新增 Provider
  fastify.post('/api/admin/platform-runtime/providers', async (req, reply) => {
    try {
      const body = req.body as any
      if (!body.provider || !body.apiKey) {
        return reply.status(400).send({ success: false, error: 'provider and apiKey are required' })
      }

      // xinghuo 需要 appid + apisecret + apiKey，打包为 JSON
      let keyToEncrypt = body.apiKey
      if (body.provider === 'xinghuo') {
        if (!body.appid || !body.apisecret) {
          return reply.status(400).send({ success: false, error: '讯飞星火需要 appid、apisecret 和 apiKey' })
        }
        keyToEncrypt = JSON.stringify({ apiKey: body.apiKey, appid: body.appid, apisecret: body.apisecret })
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO platform_provider_config (id, provider, encrypted_api_key, "baseUrl", model, is_enabled, daily_quota, health_status, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'unknown', NOW())`,
        body.provider,
        encryptKey(keyToEncrypt),
        body.baseUrl || '',
        body.model || '',
        body.isEnabled !== false,
        body.dailyQuota || 1000
      )

      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PUT /api/admin/platform-runtime/providers/:id — 更新 Provider 配置
  fastify.put('/api/admin/platform-runtime/providers/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      const body = req.body as any

      const updates: string[] = []
      const params: any[] = []
      let paramIdx = 1

      // 统一处理 id 参数（::uuid cast），提前加到 params 末尾
      // 注意：$${paramIdx} 放在 WHERE 子句，但 id 始终是 params 的最后一个元素

      if (body.apiKey) {
        // 通过 id 查原 provider 名，xinghuo 需要打包三字段
        const existingRows: any[] = await prisma.$queryRawUnsafe(
          'SELECT provider, encrypted_api_key FROM platform_provider_config WHERE id = $1::uuid',
          id
        )
        const existingConfig = existingRows[0]

        if (existingConfig?.provider === 'xinghuo') {
          let appid = body.appid || ''
          let apisecret = body.apisecret || ''
          if ((!appid || !apisecret) && existingConfig.encrypted_api_key) {
            try {
              const { decryptKey } = await import('../../services/crypto.service.js')
              const decrypted = decryptKey(existingConfig.encrypted_api_key)
              const parsed = JSON.parse(decrypted)
              if (!appid && parsed.appid) appid = parsed.appid
              if (!apisecret && parsed.apisecret) apisecret = parsed.apisecret
            } catch { /* 旧格式纯字符串，忽略 */ }
          }
          const encrypted = encryptKey(JSON.stringify({ apiKey: body.apiKey, appid, apisecret }))
          updates.push(`encrypted_api_key = $${paramIdx++}`)
          params.push(encrypted)
        } else {
          const encrypted = encryptKey(body.apiKey)
          updates.push(`encrypted_api_key = $${paramIdx++}`)
          params.push(encrypted)
        }
      }
      if (body.baseUrl !== undefined) {
        updates.push(`"baseUrl" = $${paramIdx++}`)
        params.push(body.baseUrl)
      }
      if (body.model !== undefined) {
        updates.push(`model = $${paramIdx++}`)
        params.push(body.model)
      }
      if (body.isEnabled !== undefined) {
        updates.push(`is_enabled = $${paramIdx++}`)
        params.push(body.isEnabled)
      }
      if (body.dailyQuota !== undefined) {
        updates.push(`daily_quota = $${paramIdx++}`)
        params.push(body.dailyQuota)
      }

      if (updates.length === 0) {
        return reply.send({ success: true })
      }

      // id 始终是最后一个参数，用 ::uuid 强制转换
      const idParamIdx = paramIdx
      const allParams = [...params, id]
      await prisma.$executeRawUnsafe(
        `UPDATE platform_provider_config SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idParamIdx}::uuid`,
        ...allParams
      )

      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // DELETE /api/admin/platform-runtime/providers/:id — 删除 Provider
  fastify.delete('/api/admin/platform-runtime/providers/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      await prisma.$executeRawUnsafe('DELETE FROM platform_provider_config WHERE id = $1::uuid', id)
      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/admin/platform-runtime/providers/:id/test — 测试 Provider
  fastify.post('/api/admin/platform-runtime/providers/:id/test', async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      const rows: any[] = await prisma.$queryRawUnsafe(
        'SELECT provider FROM platform_provider_config WHERE id = $1::uuid',
        id
      )
      if (!rows[0]) {
        return reply.status(404).send({ success: false, error: 'Provider not found' })
      }

      await platformRuntimeService.callLLM({
        provider: rows[0].provider,
        messages: [{ role: 'user', content: 'Reply with one word: ok' }],
        maxTokens: 10,
        temperature: 0.1,
      })

      await prisma.$executeRawUnsafe(
        "UPDATE platform_provider_config SET health_status = 'healthy', last_health_check_at = NOW() WHERE id = $1::uuid",
        id
      )

      return reply.send({ success: true, data: { status: 'healthy' } })
    } catch (err: any) {
      return reply.status(200).send({ success: false, error: err.message })
    }
  })

  // GET /api/admin/platform-runtime/usage — 用量统计
  fastify.get('/api/admin/platform-runtime/usage', async (req, reply) => {
    try {
      const query = req.query as any
      const days = parseInt(query.days) || 7
      const since = new Date()
      since.setDate(since.getDate() - days)

      const logs: any[] = await prisma.$queryRawUnsafe(
        'SELECT provider, success, tokens_in as "tokensIn", tokens_out as "tokensOut", cost FROM platform_usage_log WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 1000',
        since
      )

      // 按 provider 汇总
      const byProvider: Record<string, { calls: number; success: number; tokens: number; cost: number }> = {}
      for (const log of logs) {
        if (!byProvider[log.provider]) {
          byProvider[log.provider] = { calls: 0, success: 0, tokens: 0, cost: 0 }
        }
        byProvider[log.provider].calls++
        if (log.success) byProvider[log.provider].success++
        byProvider[log.provider].tokens += log.tokensIn + log.tokensOut
        byProvider[log.provider].cost += Number(log.cost) || 0
      }

      return reply.send({
        success: true,
        data: {
          totalCalls: logs.length,
          totalCost: logs.reduce((s, l) => s + (Number(l.cost) || 0), 0),
          byProvider,
          days,
        },
      })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/admin/platform-runtime/health-check — 运行全部健康检查
  fastify.post('/api/admin/platform-runtime/health-check', async (_req, reply) => {
    try {
      await platformRuntimeService.runHealthChecks()
      return reply.send({ success: true })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/admin/platform-runtime/compatibility — 获取所有 Provider 兼容性矩阵
  fastify.get('/api/admin/platform-runtime/compatibility', async (_req, reply) => {
    try {
      const matrix = await platformCompatibilityService.getCompatibilityMatrix()
      return reply.send({ success: true, data: matrix })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/admin/platform-runtime/compatibility/test — 测试指定 Provider 兼容性
  fastify.post('/api/admin/platform-runtime/compatibility/test', async (req, reply) => {
    try {
      const { provider } = req.body as { provider: string }
      if (!provider) {
        return reply.status(400).send({ success: false, error: 'provider is required' })
      }
      const result = await platformCompatibilityService.testCompatibility(provider)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/admin/platform-runtime/compatibility/test-all — 测试所有已配置 Provider 兼容性
  fastify.post('/api/admin/platform-runtime/compatibility/test-all', async (_req, reply) => {
    try {
      const results = await platformCompatibilityService.runAllCompatibilityChecks()
      return reply.send({ success: true, data: results })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
