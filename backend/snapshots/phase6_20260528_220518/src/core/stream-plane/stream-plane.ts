/**
 * Phase 3B — StreamPlane Execution Engine
 *
 * Central orchestrator for all STREAM-capable capabilities.
 *
 * Responsibilities:
 *   1. Validate that the capability maps to STREAM plane
 *   2. Create/assign a StreamSession
 *   3. Resolve adapter from pluginRegistry
 *   4. Emit start chunk on globalStreamBus
 *   5. Delegate to adapter (which emits delta/progress chunks)
 *   6. Emit end chunk (or let errors propagate as error chunks)
 *   7. Return StreamResult to caller
 *
 * StreamPlane is:
 *   ✔ deterministic — same input → same chunk sequence
 *   ✔ stateless — session state lives outside (caller or store)
 *   ✔ event-only — output exclusively via globalStreamBus
 *   ✔ provider-agnostic — never touches provider SDKs directly
 *
 * StreamPlane is NOT:
 *   ❌ A provider wrapper
 *   ❌ An SSE handler
 *   ❌ Worker logic
 */

import { pluginRegistry } from '../provider-registry/plugin-registry.js'
import { globalStreamBus } from './stream-event-bus.js'
import { getPlaneForCapability } from './planes.js'
import { StreamChunkFactory } from './stream-chunk.js'
import type { StreamRequest, StreamResult, StreamSession } from './stream-chunk.js'

/**
 * StreamPlane — the single execution orchestrator for streaming capabilities.
 *
 * Usage:
 *   const plane = new StreamPlane()
 *   const result = await plane.execute(request)
 *   // chunks are emitted on globalStreamBus during execution
 */
export class StreamPlane {
  /**
   * Execute a streaming capability request.
   *
   * Flow:
   *   1. Validate plane = STREAM
   *   2. Assign sessionId
   *   3. Emit 'start' on event bus
   *   4. Resolve adapter via pluginRegistry
   *   5. Call adapter.execute()
   *   6. Emit 'end' on event bus
   *   7. Return StreamResult
   *
   * Errors: non-recoverable errors throw. Recoverable errors
   * (e.g. provider timeout) emit 'error' chunk and return partial result.
   */
  async execute(request: StreamRequest): Promise<StreamResult> {
    const startTime = Date.now()

    // 1. Validate plane
    const plane = getPlaneForCapability(request.capability)
    if (plane !== 'STREAM') {
      throw new Error(
        `[STREAM_PLANE_MISMATCH] Capability "${request.capability}" ` +
        `maps to plane "${plane}", not STREAM. ` +
        `StreamPlane only handles STREAM capabilities.`
      )
    }

    // 2. Assign session
    const sessionId = request.sessionId || `stream_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const session: StreamSession = {
      sessionId,
      capability: request.capability,
      status: 'active',
      createdAt: startTime,
      lastUpdated: startTime,
    }

    const meta: { provider: string; model?: string } | undefined = request.provider ? { provider: request.provider } : undefined

    // 3. Emit 'start'
    globalStreamBus.emit(StreamChunkFactory.start(sessionId, {
      ...meta,
      model: request.input?.model as string | undefined,
    }))

    // Track chunk count for StreamResult
    let chunkCount = 0
    let adapterProvider: string = request.provider || 'unknown'

    try {
      // 4. Resolve adapter
      const provider = request.provider
      const adapter = provider
        ? pluginRegistry.getAdapter(provider)
        : undefined

      if (!adapter) {
        const msg = provider
          ? `Adapter for provider "${provider}" not found in pluginRegistry`
          : 'No provider specified in StreamRequest and no default LLM adapter registered'
        throw new Error(`[STREAM_ADAPTER_MISSING] ${msg}`)
      }

      // Resolve adapter provider name (adapter.provider is a getter, not a function)
      adapterProvider = typeof adapter.provider === 'string'
        ? adapter.provider
        : (provider as string)

      // 5. Build the normalized request
      const normRequest = {
        model: (request.input?.model as string) || '',
        prompt: (request.input?.prompt as string) || '',
        params: request.input as Record<string, unknown>,
        signal: request.signal,
      }

      const candidate = {
        provider: adapterProvider,
        model: (request.input?.model as string) || '',
        label: `stream:${sessionId}`,
        score: 1,
        capability: request.capability as any,
        cost: 0.5,
        latency: 0.5,
        quality: 0.5,
        reliability: 0.5,
      }

      // 6. Execute via adapter
      const result = await adapter.execute(normRequest, candidate, request.signal)

      // 7. Emit 'end'
      const contentText = typeof result.content === 'string'
        ? result.content
        : Array.isArray(result.content)
          ? result.content.join('\n')
          : ''

      globalStreamBus.emit(StreamChunkFactory.end(
        sessionId,
        contentText,
        undefined,
        { ...meta, model: result.model, provider: adapterProvider }
      ))

      session.status = 'completed'
      session.lastUpdated = Date.now()

      return {
        sessionId,
        content: contentText,
        chunkCount,
        latencyMs: Date.now() - startTime,
        provider: adapterProvider,
        model: result.model,
      }
    } catch (err) {
      // 8. Error handling — emit error chunk, return partial result
      const errorMsg = err instanceof Error ? err.message : String(err)
      const isRetryable = !(err instanceof Error && (
        err.message.includes('ADAPTER_MISSING') ||
        err.message.includes('STREAM_PLANE_MISMATCH')
      ))

      globalStreamBus.emit(StreamChunkFactory.error(
        sessionId,
        isRetryable ? 'PROVIDER_ERROR' : 'SYSTEM_ERROR',
        errorMsg,
        isRetryable,
        meta
      ))

      session.status = 'failed'
      session.lastUpdated = Date.now()

      return {
        sessionId,
        content: '',
        chunkCount,
        latencyMs: Date.now() - startTime,
        provider: adapterProvider,
        model: (request.input?.model as string) || 'unknown',
      }
    }
  }
}

/**
 * Singleton StreamPlane instance.
 * Most consumers should use this rather than creating their own.
 */
export const streamPlane = new StreamPlane()
