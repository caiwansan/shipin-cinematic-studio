// ============================================================
// Streaming Interface — unified stream/cancel/resume
// KMKI-PLAT-008
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context'
import type { ResourceContract, ResourceCredential, StreamingChunk, StreamingInterface } from '../types'
import { PlatformError } from '@platform/errors/platform-errors'

/**
 * Stream adapter function type.
 * Each resource/vendor can register its own streaming adapter.
 */
export type StreamAdapterFn = (
  resource: ResourceContract,
  credential: ResourceCredential,
  input: Record<string, any>,
  ctx?: PlatformContext
) => AsyncGenerator<StreamingChunk, void, undefined>

// Registered stream adapters by vendor
const streamAdapters = new Map<string, StreamAdapterFn>()

// Active stream sessions
interface StreamSession {
  abort: AbortController
  generator?: AsyncGenerator<StreamingChunk, void, undefined>
}
const activeSessions = new Map<string, StreamSession>()

/**
 * Register a stream adapter for a vendor.
 */
export function registerStreamAdapter(vendor: string, adapter: StreamAdapterFn): void {
  streamAdapters.set(vendor, adapter)
}

/**
 * Default stream adapter — for vendors without a custom adapter.
 * Returns a single chunk with the full response.
 */
const defaultAdapter: StreamAdapterFn = async function* (
  resource: ResourceContract,
  credential: ResourceCredential,
  input: Record<string, any>,
  ctx?: PlatformContext
) {
  yield {
    id: `chunk-${Date.now()}`,
    type: 'text',
    data: { message: 'No streaming adapter registered for this vendor', vendor: resource.vendor },
    timestamp: new Date().toISOString(),
    metadata: { resourceId: resource.id },
  }
  yield {
    id: `chunk-${Date.now()}-done`,
    type: 'done',
    data: {},
    timestamp: new Date().toISOString(),
  }
}

export const streamingInterface: StreamingInterface = {
  async *stream(
    resource: ResourceContract,
    credential: ResourceCredential,
    input: Record<string, any>,
    ctx?: PlatformContext
  ): AsyncGenerator<StreamingChunk, void, undefined> {
    const sessionId = `stream-${resource.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const adapter = streamAdapters.get(resource.vendor) || defaultAdapter
    const abortController = new AbortController()

    const session: StreamSession = { abort: abortController }
    activeSessions.set(sessionId, session)

    try {
      const generator = adapter(resource, credential, input, ctx)
      session.generator = generator

      for await (const chunk of generator) {
        // Check if cancelled
        if (abortController.signal.aborted) {
          yield {
            id: `${sessionId}-cancelled`,
            type: 'done',
            data: { cancelled: true, reason: 'Stream cancelled by user' },
            timestamp: new Date().toISOString(),
          }
          return
        }
        yield { ...chunk, id: `${sessionId}-${chunk.id}` }
      }
    } finally {
      activeSessions.delete(sessionId)
    }
  },

  async cancel(sessionId: string, ctx?: PlatformContext): Promise<void> {
    const session = activeSessions.get(sessionId)
    if (!session) {
      throw new PlatformError('STREAM_SESSION_NOT_FOUND', `Stream session ${sessionId} not found or already completed`)
    }
    session.abort.abort()
    activeSessions.delete(sessionId)
  },

  async resume(sessionId: string, ctx?: PlatformContext): Promise<AsyncGenerator<StreamingChunk, void, undefined> | null> {
    const session = activeSessions.get(sessionId)
    if (!session || !session.generator) {
      return null
    }
    return session.generator
  },
}

/**
 * Get active session count.
 */
export function getActiveStreamSessionCount(): number {
  return activeSessions.size
}

/**
 * Cancel all active sessions (e.g., on shutdown).
 */
export function cancelAllStreamSessions(): void {
  for (const [id, session] of activeSessions) {
    session.abort.abort()
    activeSessions.delete(id)
  }
}
