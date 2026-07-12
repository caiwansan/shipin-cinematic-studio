// ============================================================
// B3-001: SchemaVersion — DiscoverySignal 加版本号
// Signal 接口冻结为 v1.0，后续演进靠版本兼容
// ============================================================

import type { DiscoverySignal, SignalEvidence, SignalCitation, SignalType, SignalGroup } from '../../domain/discovery-signal.js'

/** Signal Schema 版本 */
export const SIGNAL_SCHEMA_VERSION = '1.0'

/** 创建一个带版本的 DiscoverySignal（自动注入 schemaVersion） */
export function createSignal(
  type: SignalType,
  provider: string,
  confidence: number,
  evidence: SignalEvidence[],
  ctx: {
    executionId: string
    tokensIn: number
    tokensOut: number
    latencyMs: number
  },
  rawReference?: string | null,
): DiscoverySignal {
  return {
    id: `sig-${ctx.executionId}-${provider}-${type}-${Date.now()}`,
    schemaVersion: SIGNAL_SCHEMA_VERSION,
    type,
    provider,
    confidence,
    evidence,
    timestamp: new Date().toISOString(),
    rawReference: rawReference ?? null,
    cost: {
      tokensIn: ctx.tokensIn,
      tokensOut: ctx.tokensOut,
      latencyMs: ctx.latencyMs,
    },
  }
}
