// ============================================================
// Admin LLM Runtime Route — Encryption Guard + Provider Health
// ============================================================
// GET  /api/admin/llm-runtime/encryption       — Encryption status
// GET  /api/admin/llm-runtime/providers        — All provider health snapshots
// GET  /api/admin/llm-runtime/providers/db     — ProviderStateService DB state
// POST /api/admin/llm-runtime/providers/:provider/check — Live health check
// ============================================================

import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../../../middleware/require-admin'
import type { FastifyRequest } from 'fastify'
import { getEncryptionGuardResult } from '../runtime/encryption-guard'
import { providerHealthRegistry } from '../runtime/provider-health'
import { getProviderStateService } from '../../../runtime/provider-state/index.js'

export default async function adminLLMRuntimeRoutes(fastify: FastifyInstance) {
  // GET /api/admin/llm-runtime/encryption — Encryption key status
  fastify.get('/api/admin/llm-runtime/encryption', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const result = getEncryptionGuardResult()
    return {
      success: true,
      data: result || { ok: false, keyConfigured: false, totalEncryptedKeys: 0, decryptedCount: 0, failedCount: 0, details: [], firstError: 'Not checked yet' },
    }
  })

  // GET /api/admin/llm-runtime/providers — All provider health (in-memory cache)
  fastify.get('/api/admin/llm-runtime/providers', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const providers = providerHealthRegistry.getAll()
    return { success: true, data: providers }
  })

  // GET /api/admin/llm-runtime/providers/db — ProviderStateService state (DB-backed, per-user)
  fastify.get('/api/admin/llm-runtime/providers/db', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const query = request.query as any
    const userId = query?.userId || ''
    let data
    if (userId) {
      const svc = getProviderStateService()
      const states = await svc.getAllForUser(userId)
      data = {
        userStates: states,
        summary: svc.getSummary(states),
      }
    } else {
      const svc = getProviderStateService()
      const cached = svc.getAllCached()
      data = {
        cachedStates: cached,
        summary: svc.getSummary(cached),
      }
    }
    return { success: true, data }
  })

  // POST /api/admin/llm-runtime/providers/:provider/check — Live health check
  fastify.post('/api/admin/llm-runtime/providers/:provider/check', { preHandler: [fastify.authenticate] }, async (request: any, reply) => {
    const { provider } = request.params as any
    const body = request.body as any
    const userId = body?.userId || 'admin'
    const model = body?.model || undefined

    const result = await providerHealthRegistry.checkProvider(provider, userId, model)
    return { success: true, data: result }
  })
}
