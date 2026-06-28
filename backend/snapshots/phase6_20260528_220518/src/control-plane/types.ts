/**
 * Control Plane — Types
 *
 * Dual-plane architecture: Data Plane (hot path) + Observability Plane (cold path).
 * These types define the observability plane's data structures only.
 * Data plane is untouched.
 */

// ── Ring Buffer ──

export interface RingBufferEntry<T> {
  seq: number           // monotonic sequence number (for ordering)
  timestamp: number     // ms since epoch
  data: T
}

export interface RingBuffer<T> {
  readonly capacity: number
  size: number
  entries: RingBufferEntry<T>[]
  cursor: number        // write cursor (next index)
  seq: number           // global sequence counter
}

// ── Policy Trace ──

export interface PolicyTrace {
  traceId: string
  requestId: string
  input: {
    signalSummary: string    // e.g. "provider=volcengine, capability=image, confidence=0.85"
    slaTier: string
  }
  decision: {
    finalProvider: string
    finalModel: string
    action: 'allow' | 'reroute' | 'fallback' | 'reject'
    fallbackChain: string[]
    confidenceAdjusted: number
  }
  reasoning: {
    appliedRules: string[]
    scoreWeights: Record<string, number>
  }
}

// ── Execution Trace ──

export interface ExecutionStep {
  step: string          // e.g. "submit", "poll", "generate"
  provider: string
  latencyMs: number
  success: boolean
}

export interface ExecutionTrace {
  traceId: string
  requestId: string
  steps: ExecutionStep[]
  totalLatencyMs: number
  wrapperCalls: number
  retries: number
}

// ── Field Snapshot ──

export interface FieldSnapshot {
  traceId: string
  requestId: string
  physics: {
    totalTension: number
    totalSlack: number
    edgeCount: number
    dominantForces: string[]
  }
  slack: {
    slackConsumed: number
    slackAvailable: number
    perturbationCount: number
  }
  bias: {
    visualConsistency: number
    cameraFreedom: number
    colorPaletteFidelity: number
    temporalFlexibility: number
  }
  style: {
    entropyScore: number
    collapsed: boolean
    explorationStrength: number
    influenceScore: number
    styleVector: number[]
  }
}

// ── Full Trace Bundle ──

export interface FullTrace {
  traceId: string
  policy: PolicyTrace | null
  execution: ExecutionTrace | null
  field: FieldSnapshot | null
  createdAt: number
}
