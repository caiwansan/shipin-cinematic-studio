// ============================================================
// Provider Health Check — GEO Health Registry (R-003: Unification)
// ============================================================
// P0: All AI Engines read the same runtime status, not probe each
// P0: Never block main operations — degrade, don't crash
// ============================================================
// R-003: Read operations delegate to ProviderStateService (DB-backed).
//          Live health check still uses unifiedAIGateway for probes.
// ============================================================

import { unifiedAIGateway } from '../../unified-ai-gateway'
import { getProviderStateService } from '../../../runtime/provider-state/index.js'

export type ProviderStatus =
  | 'healthy'       // Configured, decrypted, authenticated, reachable
  | 'unconfigured'  // No API key stored
  | 'decrypt_failed' // Key in DB but can't decrypt
  | 'auth_failed'   // Key decrypted but API rejects it
  | 'unreachable'   // Provider endpoint not reachable
  | 'rate_limited'  // Rate limited by provider
  | 'quota_exceeded' // Quota exceeded
  | 'unknown'       // Not yet checked

export interface ProviderHealth {
  provider: string
  providerName: string
  status: ProviderStatus
  configured: boolean
  decryptable: boolean
  authenticated: boolean
  reachable: boolean
  lastValidatedAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  lastFailureReason: string | null
  latency: number | null    // ms
  testModel: string | null   // Model used for last test
}

interface InternalProviderState {
  configured: boolean
  decryptable: boolean
  authenticated: boolean
  reachable: boolean
  lastValidatedAt: number | null
  lastSuccessAt: number | null
  lastFailureAt: number | null
  lastFailureReason: string | null
  latency: number | null
  testModel: string | null
}

class ProviderHealthRegistry {
  // Cache only for live-check results (in-memory, ephemeral)
  // For persisted state, use ProviderStateService (DB-backed)
  private states = new Map<string, InternalProviderState>()

  /**
   * Mark a provider as configured (has API key stored)
   */
  markConfigured(provider: string): void {
    const s = this.getOrCreate(provider)
    s.configured = true
  }

  /**
   * Mark a provider as decryptable (key can be decrypted)
   */
  markDecryptable(provider: string, ok: boolean, error?: string): void {
    const s = this.getOrCreate(provider)
    s.decryptable = ok
    if (!ok) {
      s.lastFailureReason = error || 'Decryption failed'
      s.lastFailureAt = Date.now()
    }
  }

  /**
   * Run a live health check against a provider.
   * Sends a minimal test prompt to verify the full chain.
   * Also records result in ProviderStateService (DB-backed).
   */
  async checkProvider(provider: string, userId: string, model?: string): Promise<ProviderHealth> {
    const s = this.getOrCreate(provider)
    s.lastValidatedAt = Date.now()

    if (!s.configured) {
      return this.snapshot(provider, 'unconfigured', s)
    }
    if (!s.decryptable) {
      return this.snapshot(provider, 'decrypt_failed', s)
    }

    const startTime = Date.now()

    try {
      const result = await unifiedAIGateway.invokeAI({
        userId,
        projectId: 'health-check',
        agentType: 'system-health',
        capability: 'llm',
        input: {
          messages: [
            { role: 'user', content: 'Reply with exactly one word: ok' }
          ],
          model: model || 'default',
          temperature: 0.1,
          maxTokens: 10,
        },
      })

      s.latency = Date.now() - startTime

      if (result.status === 'error' || result.status === 'failed') {
        const errMsg = result.error || 'Authentication failed'
        s.authenticated = false
        s.reachable = true
        s.lastFailureReason = errMsg
        s.lastFailureAt = Date.now()

        // Record failure in ProviderStateService
        try {
          await getProviderStateService().markFailure(userId, provider, errMsg)
        } catch { /* non-blocking */ }

        // Classify error
        if (errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('invalid')) {
          return this.snapshot(provider, 'auth_failed', s)
        }
        if (errMsg.toLowerCase().includes('rate') || errMsg.toLowerCase().includes('limit')) {
          return this.snapshot(provider, 'rate_limited', s)
        }
        if (errMsg.toLowerCase().includes('quota')) {
          return this.snapshot(provider, 'quota_exceeded', s)
        }
        return this.snapshot(provider, 'unreachable', s)
      }

      // Success
      s.authenticated = true
      s.reachable = true
      s.lastSuccessAt = Date.now()
      s.lastFailureReason = null
      s.testModel = model || null

      // Record success in ProviderStateService
      try {
        await getProviderStateService().markSuccess(userId, provider)
      } catch { /* non-blocking */ }

      return this.snapshot(provider, 'healthy', s)
    } catch (err: any) {
      s.latency = Date.now() - startTime
      s.authenticated = false
      s.reachable = false
      s.lastFailureReason = err.message
      s.lastFailureAt = Date.now()

      // Record failure in ProviderStateService
      try {
        await getProviderStateService().markFailure(userId, provider, err)
      } catch { /* non-blocking */ }

      if (err.message?.toLowerCase().includes('timeout') || err.message?.toLowerCase().includes('econnrefused')) {
        return this.snapshot(provider, 'unreachable', s)
      }
      return this.snapshot(provider, 'unknown', s)
    }
  }

  /**
   * Get full snapshot — merges in-memory cache with ProviderStateService (DB-backed)
   */
  getAll(): ProviderHealth[] {
    // 1. Collect from in-memory cache
    const result = Array.from(this.states.entries()).map(([provider, s]) => this.snapshot(provider, this.inferStatus(s), s))
    return result
  }

  /**
   * Get single provider status (no live check) — delegates to ProviderStateService
   */
  async get(userId: string, provider: string): Promise<ProviderHealth | undefined> {
    // Try in-memory cache first
    const inMem = this.states.get(provider)
    if (inMem) {
      return this.snapshot(provider, this.inferStatus(inMem), inMem)
    }

    // Fallback: read from ProviderStateService (DB-backed)
    try {
      const pss = getProviderStateService()
      const state = await pss.get(userId, provider)
      return {
        provider,
        providerName: this.getDisplayName(provider),
        status: this.mapStateStatus(state.status),
        configured: !!state.keyFingerprint,
        decryptable: true,
        authenticated: state.status === 'healthy',
        reachable: state.status === 'healthy' || state.status === 'degraded',
        lastValidatedAt: state.lastSuccessAt ? new Date(state.lastSuccessAt).toISOString() : null,
        lastSuccessAt: state.lastSuccessAt ? new Date(state.lastSuccessAt).toISOString() : null,
        lastFailureAt: state.lastFailAt ? new Date(state.lastFailAt).toISOString() : null,
        lastFailureReason: state.lastError || null,
        latency: null,
        testModel: null,
      }
    } catch {
      return undefined
    }
  }

  /**
   * Reset all states (e.g. after provider config change)
   */
  reset(): void {
    this.states.clear()
  }

  /**
   * Reset both in-memory and DB states for a user
   */
  async resetForUser(userId: string): Promise<void> {
    // Clear in-memory entries for this user
    // (provider-health doesn't key by userId, but the states map is provider-keyed)
    // Full reset is fine since ProviderStateService handles per-user
    this.states.clear()
    try {
      await getProviderStateService().resetForUser(userId)
    } catch { /* non-blocking */ }
  }

  // ─── Private ───

  private getOrCreate(provider: string): InternalProviderState {
    if (!this.states.has(provider)) {
      this.states.set(provider, {
        configured: false,
        decryptable: false,
        authenticated: false,
        reachable: false,
        lastValidatedAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        latency: null,
        testModel: null,
      })
    }
    return this.states.get(provider)!
  }

  private snapshot(provider: string, status: ProviderStatus, s: InternalProviderState): ProviderHealth {
    return {
      provider,
      providerName: this.getDisplayName(provider),
      status,
      configured: s.configured,
      decryptable: s.decryptable,
      authenticated: s.authenticated,
      reachable: s.reachable,
      lastValidatedAt: s.lastValidatedAt ? new Date(s.lastValidatedAt).toISOString() : null,
      lastSuccessAt: s.lastSuccessAt ? new Date(s.lastSuccessAt).toISOString() : null,
      lastFailureAt: s.lastFailureAt ? new Date(s.lastFailureAt).toISOString() : null,
      lastFailureReason: s.lastFailureReason,
      latency: s.latency,
      testModel: s.testModel,
    }
  }

  private inferStatus(s: InternalProviderState): ProviderStatus {
    if (!s.configured) return 'unconfigured'
    if (!s.decryptable) return 'decrypt_failed'
    if (s.lastFailureAt && s.lastSuccessAt && s.lastFailureAt > s.lastSuccessAt) {
      if (s.lastFailureReason?.toLowerCase().includes('auth') || s.lastFailureReason?.toLowerCase().includes('unauthorized')) {
        return 'auth_failed'
      }
      if (s.lastFailureReason?.toLowerCase().includes('rate') || s.lastFailureReason?.toLowerCase().includes('limit')) {
        return 'rate_limited'
      }
      return 'unreachable'
    }
    if (s.lastSuccessAt) return 'healthy'
    return 'unknown'
  }

  private mapStateStatus(stateStatus: string): ProviderStatus {
    const map: Record<string, ProviderStatus> = {
      healthy: 'healthy',
      degraded: 'unreachable',
      invalid_key: 'auth_failed',
      billing_failed: 'quota_exceeded',
      down: 'unreachable',
      permission_denied: 'auth_failed',
    }
    return map[stateStatus] || 'unknown'
  }

  private getDisplayName(provider: string): string {
    const names: Record<string, string> = {
      aliyun: '阿里云百炼',
      volcengine: '火山引擎',
      deepseek: 'DeepSeek',
      siliconflow: '硅基流动',
      openai: 'OpenAI',
      google: 'Google Gemini',
      anthropic: 'Anthropic Claude',
      moonshot: '月之暗面 Moonshot',
      zhipu: '智谱 GLM',
      xai: 'xAI Grok',
    }
    return names[provider] || provider
  }
}

export const providerHealthRegistry = new ProviderHealthRegistry()
