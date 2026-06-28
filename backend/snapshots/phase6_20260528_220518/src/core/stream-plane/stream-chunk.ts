/**
 * Phase 3A — Stream Core Types
 *
 * Canonical streaming execution model.
 * This file defines the primitive types for ALL streaming in the system.
 *
 * Rules:
 *   R1 — NO provider-specific fields
 *   R2 — event-primitive only (not response-based)
 *   R3 — every stream belongs to a StreamSession
 *
 * The entire Phase 3 stack (StreamPlane, LLMExecutionAdapter, bridge)
 * is built on these types. They must not leak provider details.
 */

// ============================================================
// StreamChunk — the atomic unit of streaming
// ============================================================

/**
 * StreamChunkType enumerates every possible event in a stream's lifecycle.
 *
 * A stream always follows:
 *   start → delta* → end        (success)
 *   start → delta* → error      (failure)
 *   start → error               (immediate failure, zero content)
 *   start → delta* → cancelled  (user cancellation)
 *
 * "progress" may appear at any point between start and end/error.
 */
export type StreamChunkType =
  | 'start'       // Stream has begun — session metadata available
  | 'delta'       // Incremental content payload
  | 'progress'    // Non-content progress update (e.g., percent, stage)
  | 'end'         // Stream completed successfully
  | 'error'       // Stream terminated with an error
  | 'cancelled'   // Stream was cancelled by caller

/**
 * StreamChunk — the single event primitive.
 *
 * Every chunk carries:
 *   - sessionId (belongs to a StreamSession)
 *   - type (what kind of event)
 *   - timestamp (when it happened)
 *   - data (payload — type-dependent shape)
 *   - meta (optional — always provider-agnostic, no SDK leak)
 *
 * "data" shape by chunk type:
 *   start:    { sessionId: string, capability: string, model: string }
 *   delta:    { content: string | Buffer }
 *   progress: { percent?: number, stage?: string, message?: string }
 *   end:      { content: string, usage?: { promptTokens, completionTokens, totalTokens } }
 *   error:    { code: string, message: string, retryable: boolean }
 *   cancelled: { reason?: string }
 */
export interface StreamChunk {
  /** Belongs to exactly one StreamSession */
  sessionId: string
  /** Discriminated event type */
  type: StreamChunkType
  /** Unix ms when the chunk was created */
  timestamp: number
  /** Type-dependent payload — see above for shapes */
  data?: Record<string, unknown>
  /**
   * Provider-agnostic metadata.
   * Never contains: API keys, raw provider responses, SDK objects.
   */
  meta?: {
    provider?: string
    model?: string
  }
}

// ============================================================
// StreamSession — lifecycle container for a stream
// ============================================================

export type StreamStatus = 'active' | 'completed' | 'failed' | 'cancelled'

/**
 * StreamSession — every stream lives in a session.
 *
 * Session is the identity root:
 *   - sessionId is the traceable identifier
 *   - status reflects the current state
 *   - createdAt / lastUpdated for monitoring
 *   - capability discriminates what kind of stream (llm, video, future)
 */
export interface StreamSession {
  /** Unique session ID (traceable across system boundaries) */
  sessionId: string
  /** Which capability this stream belongs to */
  capability: 'llm' | 'video'  // extended as new streaming capabilities are added
  /** Current lifecycle status */
  status: StreamStatus
  /** Unix ms when the session was created */
  createdAt: number
  /** Unix ms of the last activity */
  lastUpdated: number
}

// ============================================================
// StreamRequest — what the caller sends to initiate a stream
// ============================================================

/**
 * StreamRequest — the input contract to start a stream.
 *
 * Unlike DispatchInput, this is event-oriented:
 *   - stream: true is required (non-streaming LLM calls use complete())
 *   - input is the raw capability payload
 *   - signal allows caller-side cancellation
 */
export interface StreamRequest {
  /** Pre-generated session ID (or leave blank for auto) */
  sessionId?: string
  /** Which capability to invoke */
  capability: 'llm' | 'video'
  /** Raw payload for the capability adapter */
  input: Record<string, unknown>
  /** Stream is always true for Stream Plane requests */
  stream: boolean
  /** Provider override (optional — policy resolves if absent) */
  provider?: string
  /** Caller-side cancellation signal */
  signal?: AbortSignal
  /** Optional trace ID for observability linkage */
  traceId?: string
  /** User ID for policy evaluation */
  userId?: string
}

// ============================================================
// StreamResult — terminal outcome of a completed stream
// ============================================================

/**
 * StreamResult — the assembled output after a stream completes.
 *
 * This is NOT a stream primitive — it is a convenience container
 * for callers that prefer a single result event over iterating chunks.
 * The implementation can always collect chunks into a StreamResult.
 */
export interface StreamResult {
  sessionId: string
  /** Fully assembled content */
  content: string
  /** Total chunks received */
  chunkCount: number
  /** Total wall-clock time in ms */
  latencyMs: number
  /** Final usage metadata (present on end chunk) */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** Provider that served this stream */
  provider: string
  /** Model that served this stream */
  model: string
}

// ============================================================
// StreamChunkFactory — helpers for chunk creation
// ============================================================

export const StreamChunkFactory = {
  start(sessionId: string, meta?: StreamChunk['meta']): StreamChunk {
    return { sessionId, type: 'start', timestamp: Date.now(), meta }
  },

  delta(sessionId: string, content: string, meta?: StreamChunk['meta']): StreamChunk {
    return { sessionId, type: 'delta', timestamp: Date.now(), data: { content }, meta }
  },

  end(sessionId: string, content: string, usage?: { promptTokens: number; completionTokens: number; totalTokens: number }, meta?: StreamChunk['meta']): StreamChunk {
    return { sessionId, type: 'end', timestamp: Date.now(), data: { content, usage }, meta }
  },

  error(sessionId: string, code: string, message: string, retryable: boolean, meta?: StreamChunk['meta']): StreamChunk {
    return { sessionId, type: 'error', timestamp: Date.now(), data: { code, message, retryable }, meta }
  },

  progress(sessionId: string, stage: string, percent?: number, message?: string, meta?: StreamChunk['meta']): StreamChunk {
    return { sessionId, type: 'progress', timestamp: Date.now(), data: { stage, percent, message }, meta }
  },

  cancelled(sessionId: string, reason?: string, meta?: StreamChunk['meta']): StreamChunk {
    return { sessionId, type: 'cancelled', timestamp: Date.now(), data: { reason }, meta }
  },
}
