// ============================================================
// Credential Recovery API — POST /api/runtime/recovery
//                     GET  /api/runtime/recovery/errors
// ============================================================
// SSOT: 只能通过 CredentialLifecycleService 改变 Lifecycle 状态
// Recovery 成功后自动触发 ProviderStateService.refresh()
// ============================================================

import { FastifyInstance } from 'fastify'
import { getCredentialLifecycleService, CredentialLifecycleStatus } from './credential-lifecycle.service.js'
import { getProviderStateService } from '../provider-state/index.js'

interface RecoveryRequest {
  provider: string
  apiKey: string
}

interface RecoveryErrorEntry {
  provider: string
  reason: string
}

/**
 * Register recovery-related routes on the Fastify instance.
 * Both routes use the globalThis bridge for now (see TECH_DEBT.md).
 */
const registerRecoveryRoutes = async (app: FastifyInstance): Promise<void> => {
  /**
   * POST /api/runtime/recovery
   *
   * Recover a credential that is in REQUIRES_RECONFIGURATION state.
   * Request body: { provider: string, apiKey: string }
   *
   * Flow:
   *   1. CredentialLifecycleService.recoverCredential() — re-encrypt + validate
   *   2. ProviderStateService.refresh() — clear cache
   *   3. Return new Runtime Summary
   */
  app.post<{ Body: RecoveryRequest }>('/api/runtime/recovery', async (req, reply) => {
    const { provider, apiKey } = req.body

    if (!provider || !apiKey) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required fields: provider, apiKey',
      })
    }

    if (typeof provider !== 'string' || typeof apiKey !== 'string') {
      return reply.status(400).send({
        success: false,
        error: 'Invalid field types: provider and apiKey must be strings',
      })
    }

    const service = getCredentialLifecycleService()

    try {
      const result = await service.recoverCredential(provider, apiKey)

      // Refresh provider state cache so Summary reflects new state
      try {
        await getProviderStateService().refresh()
      } catch {
        // Non-blocking — cache refresh is best-effort
      }

      return reply.send({
        success: true,
        data: {
          provider,
          status: result.status,
          summary: result.summary,
        },
      })
    } catch (err: any) {
      const message = err.message || 'Unknown error during credential recovery'

      // Check if this is a state transition error (not supposed to be here)
      if (message.includes('Illegal transition')) {
        return reply.status(409).send({
          success: false,
          error: message,
        })
      }

      return reply.status(500).send({
        success: false,
        error: message,
      })
    }
  })

  /**
   * GET /api/runtime/recovery/errors
   *
   * Returns the list of providers currently in REQUIRES_RECONFIGURATION state,
   * with human-readable reasons. Used by UI to show "重新配置" prompts.
   */
  app.get('/api/runtime/recovery/errors', async (_req, reply) => {
    const service = getCredentialLifecycleService()
    const summary = await service.getSummary()

    // Read all entries to extract failure reasons for reconfig providers
    let allEntries: any[] = []
    try {
      const { prisma } = await import('../../utils/index.js')
      allEntries = await prisma.credentialRuntimeState.findMany({
        where: { lifecycleStatus: CredentialLifecycleStatus.REQUIRES_RECONFIGURATION },
        select: {
          provider: true,
          failureReason: true,
          failureCode: true,
        },
      })
    } catch {
      // Table may not exist or prisma not available
    }

    const errors: RecoveryErrorEntry[] = allEntries.map((entry: any) => ({
      provider: entry.provider,
      reason: entry.failureReason || '无法读取已保存的 API Key → 请重新配置',
    }))

    return reply.send({
      success: true,
      data: errors,
      meta: {
        total: errors.length,
      },
    })
  })
}

export { registerRecoveryRoutes }
