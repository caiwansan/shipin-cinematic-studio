// llm-config-resolver/trace.ts

import type { ConfigLayer, TraceEntry, ConfigCandidate } from './types'

export function traceDecision(
  layer: ConfigLayer,
  provider: string,
  candidate: ConfigCandidate | null,
  reason?: string
): TraceEntry {
  return {
    layer,
    provider,
    hit: !!candidate?.apiKey,
    hasKey: !!candidate?.apiKey,
    model: candidate?.model || null,
    ts: Date.now(),
    reason
  }
}
