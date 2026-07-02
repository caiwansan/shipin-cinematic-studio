// ─────────────────────────────────────────────────
// Cache Policy — 基于事件失效的缓存策略
// A1.1 — FROZEN
// ─────────────────────────────────────────────────

import type { CachePolicy } from './types'

const DEFAULT_TTL = 60 * 60 * 1000 // 1 hour

const INVALIDATION_EVENTS = [
  'scan_completed',
  'issue_updated',
  'knowledge_updated',
  'verification_completed',
]

export function createDefaultCachePolicy(): CachePolicy {
  return {
    ttl: DEFAULT_TTL,
    invalidateOn: [...INVALIDATION_EVENTS],
    cachedAt: null,
  }
}

export function isCacheValid(policy: CachePolicy, latestInvalidationTime?: number): boolean {
  if (!policy.cachedAt) return false
  const age = Date.now() - new Date(policy.cachedAt).getTime()
  if (age >= policy.ttl) return false
  if (latestInvalidationTime && new Date(policy.cachedAt).getTime() < latestInvalidationTime) return false
  return true
}

// In-memory cache (simple, will be replaced with Redis later)
const cache = new Map<string, { graph: any; policy: CachePolicy; cachedAt: string }>()

export function getCachedGraph(brandId: string): { graph: any; policy: CachePolicy } | null {
  const entry = cache.get(brandId)
  if (!entry) return null
  const policy: CachePolicy = { ...entry.policy, cachedAt: entry.cachedAt }
  if (!isCacheValid(policy)) {
    cache.delete(brandId)
    return null
  }
  return { graph: entry.graph, policy }
}

export function setCachedGraph(brandId: string, graph: any): void {
  const now = new Date().toISOString()
  const policy = createDefaultCachePolicy()
  policy.cachedAt = now
  cache.set(brandId, { graph, policy, cachedAt: now })
}

export function invalidateCache(event: string): void {
  if (!INVALIDATION_EVENTS.includes(event)) return
  cache.clear()
}

export function clearAllCache(): void {
  cache.clear()
}
