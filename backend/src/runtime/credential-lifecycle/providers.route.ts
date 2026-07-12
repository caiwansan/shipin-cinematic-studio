// ============================================================
// Runtime Providers API — GET /api/runtime/providers
// ============================================================
// Returns provider-level health summary for Admin Provider Health list.
// Aggregates credential lifecycle state per provider.
// ============================================================

import { FastifyInstance } from 'fastify'
import { getCredentialLifecycleService, CredentialLifecycleStatus } from './credential-lifecycle.service.js'

interface ProviderHealthEntry {
  provider: string
  status: 'healthy' | 'requires_reconfiguration' | 'invalid' | 'disabled'
  credentials: number
}

const registerProvidersRoute = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/runtime/providers', async (_req, reply) => {
    const service = getCredentialLifecycleService()

    // Get all entries
    const entries = await service.getAllForOwner('platform', 'platform')

    // Group by provider
    const providerMap = new Map<string, { status: string; count: number }>()

    // Also check user-level entries
    const prisma = (await import('../../utils/index.js')).prisma
    let allEntries: any[] = [...entries]
    try {
      const userEntries = await prisma.credentialRuntimeState.findMany()
      for (const e of userEntries) {
        const existing = allEntries.find(
          (ae) => ae.provider === e.provider && ae.ownerType === e.ownerType && ae.ownerId === e.ownerId,
        )
        if (!existing) {
          allEntries.push(e)
        }
      }
    } catch {
      // Table may not exist
    }

    // Aggregate per provider
    for (const entry of allEntries) {
      const provider = entry.provider || entry.provider
      const status = entry.lifecycleStatus || entry.lifecycleStatus

      if (!providerMap.has(provider)) {
        providerMap.set(provider, { status: status, count: 0 })
      }

      const current = providerMap.get(provider)!
      current.count++

      // Determine worst status as the aggregate status
      // Priority: requires_reconfiguration > invalid > disabled > healthy
      const statusPriority: Record<string, number> = {
        [CredentialLifecycleStatus.REQUIRES_RECONFIGURATION]: 0,
        [CredentialLifecycleStatus.INVALID]: 1,
        [CredentialLifecycleStatus.DISABLED]: 2,
        [CredentialLifecycleStatus.VALIDATING]: 3,
        [CredentialLifecycleStatus.NEW]: 3,
        [CredentialLifecycleStatus.ACTIVE]: 4,
      }

      const currentPriority = statusPriority[current.status] ?? 99
      const entryPriority = statusPriority[status] ?? 99

      if (entryPriority < currentPriority) {
        current.status = status
      }
    }

    // Map lifecycle status to output status strings
    const mapStatus = (lifecycleStatus: string): ProviderHealthEntry['status'] => {
      switch (lifecycleStatus) {
        case CredentialLifecycleStatus.ACTIVE:
        case CredentialLifecycleStatus.VALIDATING:
        case CredentialLifecycleStatus.NEW:
          return 'healthy'
        case CredentialLifecycleStatus.REQUIRES_RECONFIGURATION:
          return 'requires_reconfiguration'
        case CredentialLifecycleStatus.INVALID:
          return 'invalid'
        case CredentialLifecycleStatus.DISABLED:
          return 'disabled'
        default:
          return 'healthy'
      }
    }

    const result: ProviderHealthEntry[] = Array.from(providerMap.entries()).map(([provider, data]) => ({
      provider,
      status: mapStatus(data.status),
      credentials: data.count,
    }))

    // Sort: unhealthy first
    result.sort((a, b) => {
      const priority: Record<string, number> = {
        requires_reconfiguration: 0,
        invalid: 1,
        disabled: 2,
        healthy: 3,
      }
      return (priority[a.status] ?? 99) - (priority[b.status] ?? 99)
    })

    return reply.send({
      success: true,
      data: result,
    })
  })
}

export { registerProvidersRoute }
