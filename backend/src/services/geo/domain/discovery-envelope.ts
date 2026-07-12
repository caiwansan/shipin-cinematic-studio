// ============================================================
// DiscoveryEnvelope — API 返回的完整包装
// DiscoveryResult 只包含业务数据，Envelope 包含执行上下文
// 数据库只存 Result，API 返回 Envelope
// ============================================================

import type { DiscoveryResult } from './discovery-result'

export interface DiscoveryEnvelope {
  version: string
  executionId: string
  result: DiscoveryResult
  diagnostics: EnvelopeDiagnostics
  execution: ExecutionInfo
}

export interface EnvelopeDiagnostics {
  stages: StageDiagnostics[]
  totalDurationMs: number
  retries: number
  errors: string[]
}

export interface StageDiagnostics {
  id: string
  name: string
  durationMs: number
  confidence: number
  evidenceCount: number
  error?: string
}

export interface ExecutionInfo {
  projectId: string
  entityId: string
  startedAt: string
  completedAt: string
  providerTokens: Record<string, number>
  providerLatencyMs: Record<string, number>
}
