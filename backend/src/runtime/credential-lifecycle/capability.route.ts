// ============================================================
// Runtime Capability API — GET /runtime/capability
// ============================================================
// Returns AI availability status in product language.
// Does NOT expose encryption, AES, GCM, or any crypto details.
// ============================================================

import { FastifyInstance } from 'fastify'
import { getCredentialLifecycleService } from './credential-lifecycle.service.js'
import { calculateReadiness, getCategory, getCapabilityStatus } from './runtime-readiness.service.js'

const registerCapabilityRoute = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/runtime/capability', async (_req, reply) => {
    const service = getCredentialLifecycleService()
    const summary = await service.getSummary()

    // Derive lifecycle counts from summary
    const { readinessScore, totalCredentials, credentialLifecycle } = summary
    const { active, invalid, requiresReconfiguration, disabled } = credentialLifecycle

    // Recalculate with our service (consistent with configurable weights)
    const score = calculateReadiness(
      totalCredentials,
      active,
      requiresReconfiguration,
      invalid,
      disabled,
    )

    const category = getCategory(score)
    const capability = getCapabilityStatus(summary)

    return reply.send({
      aiAvailable: capability.aiAvailable,
      reason: capability.reason,
      readinessScore: score,
      readinessCategory: category,
    })
  })
}

export { registerCapabilityRoute }
