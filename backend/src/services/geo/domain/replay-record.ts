// ============================================================
// ReportMode — Pipeline Replay 的核心
// 用于 Debug、Regression、Benchmark
// 回放时使用记录的 Context，绕过真实 Provider
// ============================================================

import type { DiscoveryContext } from './discovery-context'
import type { DiscoveryEnvelope } from './discovery-envelope'

export interface ReplayRecord {
  executionId: string
  context: DiscoveryContext
  envelope: DiscoveryEnvelope
  capturedAt: string
  pipelineVersion: string
}
