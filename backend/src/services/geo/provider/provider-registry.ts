// ============================================================
// GEO AI Provider Registry — Main Entry
// RC2-T001: GEO AI Provider Infrastructure
// RC2-T002: DeepSeek Discovery Provider + Shadow Mode
//
// Central registry that:
// 1. Manages provider lifecycle (register/unregister)
// 2. Handles circuit break, retry, cache, dedup, rate limit
// 3. Provides observability via events and metrics
// 4. Supports config via env vars and runtime updates
// 5. Shadow mode: runs two providers in parallel for comparison
//
// This REPLACES the old ScannerProviderRegistry for GEO needs.
// ============================================================

import {
  GeoAIProvider,
  GeoProviderConfig,
  GeoProviderConfig as ProviderConfig,
  GeoCapability,
  DiscoveryRequest,
  DiscoveryResult,
  VerificationRequest,
  VerificationResult,
  ProviderName,
  ProviderEvent,
  ProviderMetrics,
  ProviderHealth,
  DEFAULT_GEO_PROVIDER_CONFIG,
  loadConfigFromEnv,
} from './types'
import { Cache } from './cache'
import { CircuitBreaker } from './circuit-breaker'
import { RateLimiter } from './rate-limiter'
import { RequestDeduplicator } from './request-deduplicator'
import { ProviderObservability } from './observability'
import { FallbackChain } from './fallback'
import { DeepSeekProvider } from './deepseek-provider'
import { ShadowMode, ShadowComparison } from './shadow-mode'

export class GeoProviderRegistry {
  private providers = new Map<ProviderName, GeoAIProvider>()
  private circuits: CircuitBreaker
  private rateLimiters: Map<ProviderName, RateLimiter>
  private cache: Cache
  private dedup: RequestDeduplicator
  private observability: ProviderObservability
  private config: GeoProviderConfig
  private eventListeners: Array<(event: ProviderEvent) => void>
  private fallback: FallbackChain
  private shadowMode: ShadowMode | null = null

  constructor(config?: Partial<GeoProviderConfig>) {
    const envConfig = loadConfigFromEnv()
    this.config = { ...DEFAULT_GEO_PROVIDER_CONFIG, ...envConfig, ...config }

    this.cache = new Cache(this.config.cacheTtlMs)
    this.circuits = new CircuitBreaker(
      this.config.circuitBreakThreshold,
      this.config.circuitBreakDurationMs
    )
    this.rateLimiters = new Map()
    this.dedup = new RequestDeduplicator(this.config.cacheTtlMs)
    this.observability = new ProviderObservability()
    this.eventListeners = []

    // Register DeepSeekProvider (if API key is configured, it will work; otherwise it will gracefully degrade)
    this.register(new DeepSeekProvider())

    // Initialize fallback chain — mock is NOT in production fallback chain
    // MockProvider can be manually registered for dev/test via register(new MockProvider())
    this.fallback = new FallbackChain(this, ['deepseek'])

    // Initialize shadow mode if enabled
    if (ShadowMode.isEnabled()) {
      const deepseekProv = this.providers.get('deepseek')
      if (deepseekProv) {
        this.shadowMode = new ShadowMode(deepseekProv, deepseekProv, 'deepseek', 'deepseek')
        console.log('[GeoProviderRegistry] 🌓 Shadow mode enabled: deepseek')
      }
    }
  }

  // ─── Provider Lifecycle ───

  register(provider: GeoAIProvider): void {
    this.providers.set(provider.name, provider)
    this.rateLimiters.set(provider.name, new RateLimiter())
    console.log(`[GeoProviderRegistry] ✅ Registered provider: ${provider.name} (${provider.displayName})`)
  }

  unregister(name: ProviderName): void {
    this.providers.delete(name)
    this.rateLimiters.delete(name)
    this.circuits.reset(name)
    console.log(`[GeoProviderRegistry] ❌ Unregistered provider: ${name}`)
  }

  // ─── Main APIs ───

  /**
   * Execute a discovery request through the provider.
   * If shadow mode is enabled, runs two providers in parallel.
   * Handles: circuit breaker, rate limiting, cache, dedup, retry, observability.
   */
  async discover(request: DiscoveryRequest, providerName?: ProviderName): Promise<DiscoveryResult> {
    // Shadow mode: run primary + shadow in parallel
    if (this.shadowMode) {
      const shadowResult = await this.shadowMode.discover(request)
      return shadowResult.result
    }

    const provider = this.getProvider(providerName)
    const name = provider.name

    // Check circuit breaker
    const circuitCheck = this.circuits.allowRequest(name)
    if (!circuitCheck.allowed) {
      this.emitEvent({
        provider: name,
        capability: 'discovery',
        success: false,
        latencyMs: 0,
        cached: false,
        retryCount: 0,
        error: `Circuit breaker OPEN for ${name}`,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`[GeoProviderRegistry] Circuit breaker is OPEN for provider "${name}". Request blocked.`)
    }

    // Check rate limit
    const rateLimiter = this.rateLimiters.get(name)
    if (rateLimiter && !rateLimiter.acquire(name, this.config.rateLimitPerSecond)) {
      this.emitEvent({
        provider: name,
        capability: 'discovery',
        success: false,
        latencyMs: 0,
        cached: false,
        retryCount: 0,
        error: 'Rate limit exceeded',
        timestamp: new Date().toISOString(),
      })
      throw new Error(`[GeoProviderRegistry] Rate limit exceeded for provider "${name}".`)
    }

    // Build dedup/cache key
    const cacheKey = `discover:${name}:${JSON.stringify(request)}`

    // Try cache first
    const cached = this.cache.get<DiscoveryResult>(cacheKey)
    if (cached) {
      const cachedResult: DiscoveryResult = {
        ...cached,
        meta: { ...cached.meta, cached: true },
      }
      this.emitEvent({
        provider: name,
        capability: 'discovery',
        success: true,
        latencyMs: 0,
        cached: true,
        retryCount: 0,
        timestamp: new Date().toISOString(),
      })
      return cachedResult
    }

    // Execute with retry
    return this.dedup.deduplicate(cacheKey, async () => {
      return this.executeWithRetry(
        provider,
        'discovery',
        async () => provider.discover(request),
        cacheKey
      )
    }, this.config.cacheTtlMs)
  }

  /**
   * Execute a verification request through the provider.
   * Handles: circuit breaker, rate limiting, cache, dedup, retry, observability.
   */
  async verify(request: VerificationRequest, providerName?: ProviderName): Promise<VerificationResult> {
    const provider = this.getProvider(providerName)
    const name = provider.name

    // Check circuit breaker
    const circuitCheck = this.circuits.allowRequest(name)
    if (!circuitCheck.allowed) {
      this.emitEvent({
        provider: name,
        capability: 'verification',
        success: false,
        latencyMs: 0,
        cached: false,
        retryCount: 0,
        error: `Circuit breaker OPEN for ${name}`,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`[GeoProviderRegistry] Circuit breaker is OPEN for provider "${name}". Request blocked.`)
    }

    // Check rate limit
    const rateLimiter = this.rateLimiters.get(name)
    if (rateLimiter && !rateLimiter.acquire(name, this.config.rateLimitPerSecond)) {
      this.emitEvent({
        provider: name,
        capability: 'verification',
        success: false,
        latencyMs: 0,
        cached: false,
        retryCount: 0,
        error: 'Rate limit exceeded',
        timestamp: new Date().toISOString(),
      })
      throw new Error(`[GeoProviderRegistry] Rate limit exceeded for provider "${name}".`)
    }

    // Build dedup/cache key
    const cacheKey = `verify:${name}:${JSON.stringify(request)}`

    // Try cache first
    const cached = this.cache.get<VerificationResult>(cacheKey)
    if (cached) {
      const cachedResult: VerificationResult = {
        ...cached,
        meta: { ...cached.meta, cached: true },
      }
      this.emitEvent({
        provider: name,
        capability: 'verification',
        success: true,
        latencyMs: 0,
        cached: true,
        retryCount: 0,
        timestamp: new Date().toISOString(),
      })
      return cachedResult
    }

    // Execute with retry
    return this.dedup.deduplicate(cacheKey, async () => {
      return this.executeWithRetry(
        provider,
        'verification',
        async () => provider.verify(request),
        cacheKey
      )
    }, this.config.cacheTtlMs)
  }

  // ─── Provider Query ───

  getProvider(name?: ProviderName): GeoAIProvider {
    const key = name || this.config.provider
    const provider = this.providers.get(key)
    if (!provider) {
      throw new Error(`[GeoProviderRegistry] No provider registered: "${key}". Registered: ${this.listProviders().join(', ')}`)
    }
    return provider
  }

  listProviders(): ProviderName[] {
    return Array.from(this.providers.keys())
  }

  async providerHealth(name?: ProviderName): Promise<ProviderHealth[]> {
    const providersToCheck = name
      ? [this.getProvider(name)]
      : Array.from(this.providers.values())

    const results: ProviderHealth[] = []
    for (const provider of providersToCheck) {
      const startTime = Date.now()
      try {
        const health = await provider.health()
        results.push({
          name: provider.name,
          displayName: provider.displayName,
          healthy: health.ok,
          state: health.ok ? 'healthy' : 'down',
          latencyMs: health.latencyMs,
          lastError: health.error,
          lastChecked: new Date().toISOString(),
        })
      } catch (err: any) {
        results.push({
          name: provider.name,
          displayName: provider.displayName,
          healthy: false,
          state: 'down',
          latencyMs: Date.now() - startTime,
          lastError: err.message || 'Unknown error',
          lastChecked: new Date().toISOString(),
        })
      }
    }
    return results
  }

  // ─── Fallback ───

  getFallbackChain(): FallbackChain {
    return this.fallback
  }

  // ─── Shadow Mode ───

  /**
   * Check if shadow mode is active.
   */
  isShadowModeEnabled(): boolean {
    return this.shadowMode !== null
  }

  /**
   * Enable shadow mode.
   */
  enableShadowMode(primary: ProviderName, shadow?: ProviderName): void {
    const primaryProv = this.providers.get(primary)
    const shadowProv = shadow ? this.providers.get(shadow) : primaryProv
    if (primaryProv && shadowProv) {
      this.shadowMode = new ShadowMode(primaryProv, shadowProv, primary, shadow || primary)
      console.log(`[GeoProviderRegistry] 🌓 Shadow mode enabled: ${primary} (primary) + ${shadow || primary} (shadow)`)
    }
  }

  /**
   * Disable shadow mode.
   */
  disableShadowMode(): void {
    this.shadowMode = null
    console.log('[GeoProviderRegistry] 🌓 Shadow mode disabled')
  }

  /**
   * Get shadow mode comparisons.
   */
  getShadowComparisons(): ShadowComparison[] {
    return this.shadowMode ? this.shadowMode.getComparisons() : []
  }

  /**
   * Get shadow mode comparison summary.
   */
  getShadowComparisonSummary(): any {
    return this.shadowMode ? this.shadowMode.getComparisonSummary() : null
  }

  // ─── Observability ───

  onEvent(listener: (event: ProviderEvent) => void): void {
    this.eventListeners.push(listener)
  }

  getMetrics(provider?: ProviderName): ProviderMetrics {
    return this.observability.getMetrics(provider)
  }

  // ─── Config ───

  updateConfig(config: Partial<GeoProviderConfig>): void {
    Object.assign(this.config, config)

    // Check if shadow mode toggle changed
    if (config.provider !== undefined) {
      if (ShadowMode.isEnabled() && !this.shadowMode) {
        const activeProvider = this.config.provider as ProviderName || 'deepseek'
        this.enableShadowMode(activeProvider)
      } else if (!ShadowMode.isEnabled() && this.shadowMode) {
        this.disableShadowMode()
      }
    }

    console.log(`[GeoProviderRegistry] Config updated:`, JSON.stringify(this.config))
  }

  getConfig(): GeoProviderConfig {
    return { ...this.config }
  }

  // ─── Internal ───

  private emitEvent(event: ProviderEvent): void {
    this.observability.recordEvent(event)
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[GeoProviderRegistry] Event listener error:', err)
      }
    }
  }

  /**
   * Execute a provider call with retry logic.
   */
  private async executeWithRetry<T extends { meta: { provider: ProviderName; latencyMs: number; tokenUsage?: any; cost?: number; cached: boolean } }>(
    provider: GeoAIProvider,
    capability: GeoCapability,
    fn: () => Promise<T>,
    cacheKey: string
  ): Promise<T> {
    const name = provider.name
    const maxRetries = this.config.retryCount
    const baseDelay = this.config.retryBaseDelayMs
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now()

      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(fn(), this.config.timeoutMs)

        const latencyMs = Date.now() - startTime

        // Record success in circuit breaker
        this.circuits.recordSuccess(name)

        // Cache the result
        this.cache.set(cacheKey, result)

        // Emit event
        this.emitEvent({
          provider: name,
          capability,
          success: true,
          latencyMs,
          cached: false,
          retryCount: attempt,
          tokenUsage: result.meta.tokenUsage,
          cost: result.meta.cost,
          timestamp: new Date().toISOString(),
        })

        // Mark result as non-cached fresh result
        return {
          ...result,
          meta: { ...result.meta, cached: false },
        }
      } catch (err: any) {
        const latencyMs = Date.now() - startTime
        lastError = err

        const isTimeout = err.message?.includes('timeout') || err.message?.includes('TIMEOUT')
        const timedOut = isTimeout

        // Record failure in circuit breaker
        this.circuits.recordFailure(name)

        // Emit failure event
        this.emitEvent({
          provider: name,
          capability,
          success: false,
          latencyMs,
          cached: false,
          retryCount: attempt,
          error: err.message || 'Unknown error',
          timestamp: new Date().toISOString(),
        })

        // If last attempt or circuit is now open, throw
        if (attempt >= maxRetries) {
          throw err
        }

        // Wait with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt)
        console.warn(`[GeoProviderRegistry] ${name}.${capability} attempt ${attempt + 1}/${maxRetries + 1} failed: ${err.message}. Retrying in ${delay}ms...`)
        await this.sleep(delay)
      }
    }

    throw lastError || new Error(`Unknown error executing ${name}.${capability}`)
  }

  /**
   * Execute a promise with timeout.
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`TIMEOUT: Request exceeded ${timeoutMs}ms`))
      }, timeoutMs)

      promise.then(
        (result) => {
          clearTimeout(timer)
          resolve(result)
        },
        (err) => {
          clearTimeout(timer)
          reject(err)
        }
      )
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ─── Singleton ───

/** Singleton instance — the single GEO Provider Registry for the entire app */
export const geoProviderRegistry = new GeoProviderRegistry()
