/**
 * Phase 3C — LLM Execution Adapter (Bridge)
 *
 * Bridges legacy runtime/providers LLM system into the EGOS StreamPlane.
 *
 * Design rules:
 *   R1 — src/runtime/providers/** is NEVER modified
 *   R2 — getProvider() is the ONLY import from legacy runtime
 *   R3 — adapter.execute() returns NormalizedResponse (same contract as all other adapters)
 *   R4 — StreamPlane handles chunk emission, NOT the adapter
 *
 * This adapter does NOT implement true streaming (token-by-token).
 * All legacy LLM calls use stream:false. The adapter calls provider.call()
 * as an atomic request, and StreamPlane emits the complete response as an 'end' chunk.
 *
 * If future provider runtimes support native SSE streaming, this adapter
 * can be upgraded to emit incremental 'delta' chunks — without changing
 * the adapter interface, because StreamPlane processes the NormalizedResponse
 * the same way regardless.
 */

import type { ModelPluginAdapter, Candidate, NormalizedRequest, NormalizedResponse } from '../provider-registry/types.js'

/**
 * Import getProvider from the legacy runtime.
 * This is the ONLY bridge point — all provider routing/failover/retry
 * remains in the legacy runtime. The adapter is a protocol translator,
 * NOT a provider reimplementation.
 */
// Dynamic import to avoid circular dependency if runtime imports from core
let _getProvider: ((name: string) => any) | null = null
async function ensureProvider(): Promise<any> {
  if (!_getProvider) {
    const mod = await import('../../runtime/providers/provider.registry.js')
    _getProvider = mod.getProvider
  }
  return _getProvider
}

/**
 * LLMExecutionAdapter — bridges legacy LLM providers into the adapter framework.
 *
 * Registered in pluginRegistry so that:
 *   dispatchByCapability('llm', ...) → StreamPlane → adapter.execute() → legacy provider
 *
 * Each LLM provider (deepseek, openai, kimi, etc.) gets its own adapter instance.
 */
export class LLMExecutionAdapter implements ModelPluginAdapter {
  readonly provider: string
  private _models: string[]

  constructor(providerName: string, models: string[]) {
    this.provider = providerName
    this._models = models
  }

  /**
   * models() — returns Candidate entries for plugin registration.
   */
  models(): Candidate[] {
    return this._models.map((model, i) => ({
      provider: this.provider,
      model,
      capability: 'llm' as const,
      cost: 0.5,
      latency: 0.5,
      quality: 0.5,
      reliability: 0.5,
    }))
  }

  /**
   * execute() — bridges to legacy provider.call().
   *
   * Flow:
   *   1. getProvider from legacy runtime
   *   2. Convert NormalizedRequest → LLMRequest (messages from params)
   *   3. provider.call(request, signal)
   *   4. Convert LLMResponse → NormalizedResponse
   *
   * Note: StreamPlane.execute() wraps this in the event lifecycle.
   * The adapter does NOT know about StreamPlane or EventBus.
   */
  async execute(
    request: NormalizedRequest,
    _candidate: Candidate,
    signal?: AbortSignal
  ): Promise<NormalizedResponse> {
    const getProvider = await ensureProvider()
    const provider = getProvider(this.provider)

    if (!provider) {
      throw new Error(
        `[LLM_ADAPTER] Legacy provider "${this.provider}" not found in runtime registry. ` +
        `Available: ${Object.keys(provider.registry || {}).join(', ')}`
      )
    }

    const model = request.model || this._models[0]
    const messages = (request.params?.messages as Array<{ role: string; content: string }>) || []
    const temperature = (request.params?.temperature as number) ?? 0.7
    const maxTokens = (request.params?.maxTokens as number) ?? 4096

    const startTime = Date.now()

    const response = await provider.call(
      {
        model,
        messages: messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        })),
        temperature,
        maxTokens,
        stream: false,
      },
      signal
    )

    return {
      content: response.content,
      model: response.model || model,
      latencyMs: Date.now() - startTime,
      raw: {
        usage: response.usage,
        providerResponse: true,
        providerName: this.provider,
      },
    }
  }

  /**
   * healthCheck() — ping the legacy provider.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const getProvider = await ensureProvider()
      const provider = getProvider(this.provider)
      return provider !== undefined
    } catch {
      return false
    }
  }

  /**
   * label() — human-readable name.
   */
  label(): string {
    return `LLM:${this.provider}`
  }
}
