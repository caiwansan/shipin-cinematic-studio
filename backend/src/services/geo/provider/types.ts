// ============================================================
// GEO AI Provider — Core Types
// RC2-T001: GEO AI Provider Infrastructure
// ============================================================

export type ProviderName = 'mock' | 'deepseek' | string

export interface GeoProviderConfig {
  provider: ProviderName
  timeoutMs: number          // default 30000
  retryCount: number         // default 3
  retryBaseDelayMs: number   // default 1000
  cacheTtlMs: number         // default 60000
  circuitBreakThreshold: number // default 5
  circuitBreakDurationMs: number // default 30000
  rateLimitPerSecond: number // default 10
}

export const DEFAULT_GEO_PROVIDER_CONFIG: GeoProviderConfig = {
  provider: (process.env.GEO_AI_PROVIDER as ProviderName) || 'deepseek',
  timeoutMs: 30000,
  retryCount: 3,
  retryBaseDelayMs: 1000,
  cacheTtlMs: 60000,
  circuitBreakThreshold: 5,
  circuitBreakDurationMs: 30000,
  rateLimitPerSecond: 10,
}

// Discovery capability

export interface DiscoveryRequest {
  entity: string
  industry?: string
  description?: string
  website?: string
  matchConfidences: Record<string, number>
}

export interface DiscoveryResult {
  scenarios: Array<{
    scenarioId: string
    scenarioName: string
    industryId: string
    entityCoverage: boolean
    coverageScore: number
    confidence: number
    trend: 'up' | 'stable' | 'down'
  }>
  coverage: number
  share: number
  position: number
  meta: {
    provider: ProviderName
    latencyMs: number
    tokenUsage?: { prompt: number; completion: number; total: number }
    cost?: number
    cached: boolean
  }
}

// Verification capability

export interface VerificationRequest {
  entity: string
  projectId: string
  claims: string[]
}

export interface VerificationResult {
  claims: Array<{
    claimId: string
    claim: string
    verified: boolean
    confidence: number
    evidence: string[]
  }>
  overallConfidence: number
  meta: {
    provider: ProviderName
    latencyMs: number
    tokenUsage?: { prompt: number; completion: number; total: number }
    cost?: number
    cached: boolean
  }
}

// Provider capability

export type GeoCapability = 'discovery' | 'verification'

// Provider interface

export interface GeoAIProvider {
  readonly name: ProviderName
  readonly displayName: string
  readonly capabilities: GeoCapability[]
  discover(request: DiscoveryRequest): Promise<DiscoveryResult>
  verify(request: VerificationRequest): Promise<VerificationResult>
  health(): Promise<{ ok: boolean; latencyMs: number; error?: string }>
}

// Provider event for observability

export interface ProviderEvent {
  provider: ProviderName
  capability: GeoCapability
  success: boolean
  latencyMs: number
  cached: boolean
  retryCount: number
  tokenUsage?: { prompt: number; completion: number; total: number }
  cost?: number
  error?: string
  timestamp: string
}

// Provider health summary

export interface ProviderHealth {
  name: ProviderName
  displayName: string
  healthy: boolean
  state: 'healthy' | 'degraded' | 'down'
  latencyMs: number
  lastError?: string
  lastChecked: string
}

// Provider metrics summary

export interface ProviderMetrics {
  totalRequests: number
  successCount: number
  failureCount: number
  timeoutCount: number
  retryCount: number
  cacheHits: number
  cacheMisses: number
  tokenUsage: { prompt: number; completion: number; total: number }
  cost: number
  latencyMs: {
    p50: number
    p95: number
    p99: number
    avg: number
  }
  successRate: number
  errorRate: number
  timeoutRate: number
  retryRate: number
  cacheHitRate: number
  byProvider: Record<ProviderName, {
    totalRequests: number
    successCount: number
    failureCount: number
    latencyMs: { p50: number; p95: number; p99: number; avg: number }
    successRate: number
    cacheHitRate: number
  }>
}

// Config via env var

export function loadConfigFromEnv(): Partial<GeoProviderConfig> {
  const config: Partial<GeoProviderConfig> = {}

  const envProvider = process.env.GEO_AI_PROVIDER
  if (envProvider) {
    config.provider = envProvider as ProviderName
  }

  const envConfig = process.env.GEO_AI_PROVIDER_CONFIG
  if (envConfig) {
    try {
      const parsed = JSON.parse(envConfig)
      Object.assign(config, parsed)
    } catch (e) {
      console.warn('[GeoProvider] Failed to parse GEO_AI_PROVIDER_CONFIG:', e)
    }
  }

  return config
}
