// ============================================================
// Resource Resolver — auto-select Resource by Capability + Strategy
// KMKI-PLAT-008
// ============================================================

import type { ResourceContract, ResourceCapabilityMatrix, ResourceHealth, ResolveRequest, ResolveResponse, ResolverStrategy } from '../types'
import { contractRepository } from '../repositories/contract.repository'
import { credentialRepository } from '../repositories/credential.repository'
import { matrixRepository } from '../repositories/matrix.repository'
import { healthRepository } from '../repositories/health.repository'
import { PlatformError } from '@platform/errors/platform-errors'

// Registered strategies
const strategies = new Map<string, ResolverStrategy>()

export const resourceResolver = {
  /**
   * Register a resolver strategy.
   */
  registerStrategy(strategy: ResolverStrategy): void {
    strategies.set(strategy.name, strategy)
  },

  /**
   * Resolve the best resource for a given capability and strategy.
   */
  async resolve(request: ResolveRequest): Promise<ResolveResponse> {
    const startTime = Date.now()

    // 1. Find the strategy
    const strategy = strategies.get(request.strategy)
    if (!strategy) {
      throw new PlatformError('RESOLVER_STRATEGY_NOT_FOUND', `Resolver strategy "${request.strategy}" not found. Available: ${Array.from(strategies.keys()).join(', ')}`)
    }

    // 2. Find all resources that support the capability
    const matrixEntries = await matrixRepository.findByCapabilityId(request.capabilityName)
    if (matrixEntries.length === 0) {
      throw new PlatformError('RESOLVER_NO_RESOURCE', `No resources found for capability "${request.capabilityName}"`)
    }

    // 3. Get the actual resource contracts
    const candidates: Array<{
      resource: ResourceContract
      matrix: ResourceCapabilityMatrix | null
      health: ResourceHealth | null
      score: number
    }> = []

    for (const entry of matrixEntries) {
      const resource = await contractRepository.findById(entry.resourceId)
      if (!resource || resource.status !== 'active') continue

      // Apply vendor preference filter
      if (request.options?.preferredVendors && !request.options.preferredVendors.includes(resource.vendor)) continue

      // Get health
      const health = await healthRepository.findLatestByResourceId(resource.id)

      // Apply health filter — skip down resources
      if (health && health.status === 'down') continue

      // Apply latency filter
      if (request.options?.maxLatencyMs && health && health.latencyMs && health.latencyMs > request.options.maxLatencyMs) continue

      // Calculate score
      const score = strategy.score(resource, entry, health, request)
      candidates.push({ resource, matrix: entry, health, score })
    }

    if (candidates.length === 0) {
      throw new PlatformError('RESOLVER_NO_CANDIDATES', `No suitable resources found for capability "${request.capabilityName}" after filtering`)
    }

    // 4. Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score)

    // 5. Get credential for the best candidate
    const best = candidates[0]
    let credential
    try {
      credential = await credentialRepository.findByResourceAndTenant(
        best.resource.id,
        request.tenantId,
        request.workspaceId
      )
    } catch {
      // Fallback: try without workspace
      credential = await credentialRepository.findByResourceAndTenant(
        best.resource.id,
        request.tenantId
      )
    }

    if (!credential) {
      throw new PlatformError('RESOLVER_NO_CREDENTIAL', `No credential found for resource "${best.resource.name}" and tenant "${request.tenantId}". Please add your API key.`)
    }

    const resolveTimeMs = Date.now() - startTime

    // 6. Build alternatives list
    const alternatives = candidates.slice(1, 3).map(c => ({
      resource: c.resource,
      reason: `Score: ${c.score.toFixed(2)}`,
    }))

    return {
      resource: best.resource,
      credential,
      resolvedStrategy: request.strategy,
      resolveTimeMs,
      confidence: candidates.length > 0 ? Math.min(1, best.score / (candidates[0]?.score || 1)) : 0.5,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    }
  },

  /**
   * List available strategies.
   */
  listStrategies(): Array<{ name: string; description: string }> {
    return Array.from(strategies.values()).map(s => ({
      name: s.name,
      description: s.description,
    }))
  },

  /**
   * Check if a capability has any resolvable resources for a tenant.
   */
  async hasResolvable(capabilityName: string, tenantId: string): Promise<boolean> {
    try {
      const matrixEntries = await matrixRepository.findByCapabilityId(capabilityName)
      for (const entry of matrixEntries) {
        const credential = await credentialRepository.findByResourceAndTenant(entry.resourceId, tenantId)
        if (credential && credential.status === 'active') return true
      }
      return false
    } catch {
      return false
    }
  },
}
