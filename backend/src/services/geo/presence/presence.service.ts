// ============================================================
// P0-B.3: Presence Evidence Integration — Service
//
// Lightweight normalization layer between PresenceEngine and
// Verification. No DB writes. No dedup.
//
// Adapter → Engine → Service → Verification (Evidence Timeline)
// ============================================================

import { createHash } from 'node:crypto'
import { PresenceEngine } from './engine.js'
import { providerAdapterRegistry } from './registry.js'
import { presenceRepository } from './presence.repository.js'
import type { PresenceContext } from './types.js'
import type { PresenceResult, PresenceEvidence } from './presence.types.js'

// Local singleton — avoids circular dep via ./index.js
const presenceEngine = new PresenceEngine(providerAdapterRegistry)

/**
 * Map a ProviderResult's visibility to our unified status.
 */
function visibilityToStatus(visibility: string): PresenceResult['status'] {
  switch (visibility) {
    case 'visible':
    case 'partial':
      return 'FOUND'
    case 'missing':
      return 'NOT_FOUND'
    case 'checking':
      return 'UNKNOWN'
    case 'unknown':
    default:
      return 'UNKNOWN'
  }
}

/**
 * Generate a deterministic request hash (for downstream dedup use).
 */
function computeRequestHash(provider: string, entity: string, payload: unknown): string {
  return createHash('md5')
    .update(`${provider}:${entity}:${JSON.stringify(payload)}`)
    .digest('hex')
}

export class PresenceService {
  /**
   * Run a full presence check and return normalized PresenceResult[].
   * No DB writes. Output is ready for Verification consumption.
   */
  async checkAllFromService(context: PresenceContext): Promise<PresenceResult[]> {
    const engineResult = await presenceEngine.checkAll(context)
    const results: (PresenceResult & { recordId?: string })[] = []

    for (const providerResult of engineResult.providers) {
      const entity = context.name
      const checkedAt = engineResult.checkedAt
      const status = visibilityToStatus(providerResult.visibility)

      const requestHash = computeRequestHash(providerResult.provider, entity, providerResult)
      const evidence: PresenceEvidence = {
        requestHash,
        source: `provider:${providerResult.provider}`,
        provider: providerResult.provider,
        entity,
        checkedAt,
        status,
        confidence: providerResult.confidence,
      }

      // Dedup check + persist (silent — never throws)
      let recordId: string | undefined
      try {
        const existing = await presenceRepository.findRecentByHash(requestHash, 24)
        if (existing) {
          recordId = existing.id
        } else {
          const saved = await presenceRepository.create({
            projectId: context.projectId,
            provider: providerResult.provider,
            entity,
            status,
            confidence: providerResult.confidence,
            requestHash,
            source: `provider:${providerResult.provider}`,
            checkedAt: new Date(checkedAt),
            latencyMs: 0,
            metadata: { explain: providerResult.explain },
          })
          recordId = saved.id
        }
      } catch {
        // Persistence failure is non-fatal — evidence still returned
      }

      results.push({
        provider: providerResult.provider,
        entity,
        status,
        confidence: providerResult.confidence,
        checkedAt,
        latencyMs: 0,
        reason: providerResult.explain,
        evidence,
        recordId,
      })
    }

    return results
  }

  /**
   * Check a single provider and return normalized PresenceResult.
   */
  async checkProviderFromService(
    provider: string,
    context: PresenceContext
  ): Promise<PresenceResult & { recordId?: string }> {
    const providerResult = await presenceEngine.checkProvider(provider, context)
    const entity = context.name
    const checkedAt = new Date().toISOString()
    const status = visibilityToStatus(providerResult.visibility)

    const requestHash = computeRequestHash(provider, entity, providerResult)
    const evidence: PresenceEvidence = {
      requestHash,
      source: `provider:${provider}`,
      provider,
      entity,
      checkedAt,
      status,
      confidence: providerResult.confidence,
    }

    // Dedup check + persist (silent — never throws)
    let recordId: string | undefined
    try {
      const existing = await presenceRepository.findRecentByHash(requestHash, 24)
      if (existing) {
        recordId = existing.id
      } else {
        const saved = await presenceRepository.create({
          projectId: context.projectId,
          provider,
          entity,
          status,
          confidence: providerResult.confidence,
          requestHash,
          source: `provider:${provider}`,
          checkedAt: new Date(checkedAt),
          latencyMs: 0,
          metadata: { explain: providerResult.explain },
        })
        recordId = saved.id
      }
    } catch {
      // Persistence failure is non-fatal
    }

    return {
      provider,
      entity,
      status,
      confidence: providerResult.confidence,
      checkedAt,
      latencyMs: 0,
      reason: providerResult.explain,
      evidence,
      recordId,
    }
  }
}

// Singleton export
export const presenceService = new PresenceService()
