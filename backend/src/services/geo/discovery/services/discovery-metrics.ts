// ============================================================
// DiscoveryMetrics — 每次执行的完整指标记录
// 用于 Monitor Dashboard、Explain、Timeline、Debug
// ============================================================

import type { DiscoveryEnvelope } from '../../domain/discovery-envelope.js'

export interface DiscoveryMetricsRecord {
  executionId: string
  projectId: string
  entityId: string
  engineVersion: string
  startedAt: string
  completedAt: string
  totalDurationMs: number
  stages: StageMetrics[]
  providers: ProviderMetrics[]
  overallConfidence: number
  evidenceCount: number
  valid: boolean
}

export interface StageMetrics {
  id: string
  name: string
  durationMs: number
  confidence: number
  evidenceCount: number
}

export interface ProviderMetrics {
  name: string
  latencyMs: number
  tokens: number
  success: boolean
}

export class DiscoveryMetricsCollector {
  private records: DiscoveryMetricsRecord[] = []

  collect(envelope: DiscoveryEnvelope, engineVersion: string): DiscoveryMetricsRecord {
    const record: DiscoveryMetricsRecord = {
      executionId: envelope.executionId,
      projectId: envelope.execution.projectId,
      entityId: envelope.execution.entityId,
      engineVersion,
      startedAt: envelope.execution.startedAt,
      completedAt: envelope.execution.completedAt,
      totalDurationMs: envelope.diagnostics.totalDurationMs,
      stages: envelope.diagnostics.stages.map((s) => ({
        id: s.id,
        name: s.name,
        durationMs: s.durationMs,
        confidence: s.confidence,
        evidenceCount: s.evidenceCount,
      })),
      providers: Object.entries(envelope.execution.providerLatencyMs).map(
        ([name, latencyMs]) => ({
          name,
          latencyMs,
          tokens: envelope.execution.providerTokens[name] ?? 0,
          success: true,
        }),
      ),
      overallConfidence: envelope.result.metadata.overralConfidence,
      evidenceCount: envelope.result.evidence.totalCount,
      valid: true,
    }

    this.records.push(record)
    return record
  }

  getLatest(): DiscoveryMetricsRecord | undefined {
    return this.records[this.records.length - 1]
  }

  getAll(): DiscoveryMetricsRecord[] {
    return [...this.records]
  }

  clear(): void {
    this.records = []
  }
}

export const discoveryMetrics = new DiscoveryMetricsCollector()
