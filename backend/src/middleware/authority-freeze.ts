// src/middleware/authority-freeze.ts
// FIX 2026-07-23: KMKI Authority Freeze Middleware
// 禁止向冻结表写入新数据，允许读取现有数据

import type { FastifyInstance } from 'fastify'

const FROZEN_TABLES: Record<string, { alternative: string }> = {
  'governance_user': { alternative: 'User' },
  'governance_tenant': { alternative: 'Organization' },
  'governance_subscription': { alternative: 'Subscription' },
  'ApiKey': { alternative: 'credential_vault' }
}

const FROZEN_CREDENTIAL_PATHS = [
  { path: '/api/user-model-config', method: 'POST', reason: 'Use /api/vault/credentials' },
  { path: '/api/enterprise-llm-config', method: 'POST', reason: 'Use /api/vault/credentials' },
  { path: '/api/resource-credential', method: 'POST', reason: 'Use /api/vault/credentials' },
  { path: '/api/api-key', method: 'POST', reason: 'Use /api/vault/credentials' }
]

const HTTP_METHODS_WRITE = ['POST', 'PUT', 'PATCH', 'DELETE']

export async function authorityFreezeMiddleware(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    const method = request.method
    if (!HTTP_METHODS_WRITE.includes(method)) return

    const requestBody = JSON.stringify((request as any).body || {})
    const path = request.url

    const frozenMatch = Object.keys(FROZEN_TABLES).find(key =>
      path.includes(key) || requestBody.includes(key)
    )

    if (frozenMatch) {
      const config = FROZEN_TABLES[frozenMatch]
      request.log.warn('AUTHORITY_FROZEN_VIOLATION', {
        table: frozenMatch,
        attemptedBy: (request as any).user?.id || 'anonymous',
        path,
        method,
        timestamp: new Date().toISOString()
      })
      return reply.status(403).json({
        error: 'AUTHORITY_FROZEN',
        message: `${frozenMatch} is frozen. Use ${config.alternative} instead.`,
        constitution: 'KMKI-AUTHORITY-CONSTITUTION-v0.1'
      })
    }

    for (const frozen of FROZEN_CREDENTIAL_PATHS) {
      if (path.includes(frozen.path) && method === frozen.method) {
        return reply.status(403).json({
          error: 'AUTHORITY_FROZEN',
          message: `${frozen.path} is frozen. ${frozen.reason}.`,
          constitution: 'KMKI-AUTHORITY-CONSTITUTION-v0.1'
        })
      }
    }
  })
}
