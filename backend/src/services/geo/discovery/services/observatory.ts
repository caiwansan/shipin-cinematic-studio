// ============================================================
// RC-D1-003: Discovery Observatory
//
// 实时查看 Discovery 执行时间线：
//   - Execution Timeline（Pipeline Stage 耗时 + Provider 耗时）
//   - Signal Confidence 分布
//   - Evidence 数量
//   - Replay Errors
//
// 以后排查为什么 confidence=0.32 / provider timeout 都不用看 log
// ============================================================

import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'

interface TimelineEntry {
  stage: string
  startTime: string
  endTime: string
  durationMs: number
  status: 'running' | 'completed' | 'failed'
  error?: string
}

interface SignalSummary {
  type: string
  provider: string
  confidence: number
  evidenceCount: number
  hasCitation: boolean
}

interface ReplaySummary {
  replayCount: number
  lastReplayAt: string | null
  errors: number
}

interface ObservatorySnapshot {
  executionId: string
  projectId: string
  entityName: string
  startedAt: string
  durationMs: number
  timeline: TimelineEntry[]
  providerLatency: { provider: string; latencyMs: number }[]
  signals: SignalSummary[]
  stats: {
    totalSignals: number
    totalEvidence: number
    avgConfidence: number
    minConfidence: number
    maxConfidence: number
    providersCount: number
  }
  replay: ReplaySummary
  envelopeSizeBytes: number
}

/**
 * 从 DiscoveryEnvelope 生成 Observatory Snapshot
 */
export function buildObservatorySnapshot(envelope: DiscoveryEnvelope): ObservatorySnapshot {
  const signals = envelope.result.metadata.signals || []
  const providers = envelope.result.metadata.providers || []
  const diagnostics = envelope.diagnostics
  const execution = envelope.execution

  // Timelines
  const timeline: TimelineEntry[] = []
  if (diagnostics?.stages) {
    for (const stage of diagnostics.stages) {
      timeline.push({
        stage: stage.name,
        startTime: stage.startedAt,
        endTime: stage.completedAt,
        durationMs: stage.durationMs,
        status: stage.error ? 'failed' : 'completed',
        error: stage.error,
      })
    }
  }

  // Provider Latency
  const providerLatency = providers.map((p) => ({
    provider: p.name,
    latencyMs: p.latencyMs || 0,
  }))

  // Signal summary
  const signalSummary: SignalSummary[] = signals.map((s) => ({
    type: s.type,
    provider: s.provider,
    confidence: s.confidence,
    evidenceCount: s.evidence.length,
    hasCitation: s.evidence.some((e) => e.citation !== undefined && e.citation !== null),
  }))

  // Stats
  const confidences = signals.map((s) => s.confidence)
  const avgConfidence = confidences.length > 0
    ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 1000) / 1000
    : 0

  const snapshot: ObservatorySnapshot = {
    executionId: envelope.executionId,
    projectId: execution.projectId,
    entityName: envelope.result.entity.name,
    startedAt: execution.timestamp || new Date().toISOString(),
    durationMs: envelope.result.metadata.latencyMs || 0,
    timeline,
    providerLatency,
    signals: signalSummary,
    stats: {
      totalSignals: signals.length,
      totalEvidence: signals.reduce((s, sig) => s + sig.evidence.length, 0),
      avgConfidence,
      minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
      maxConfidence: confidences.length > 0 ? Math.max(...confidences) : 0,
      providersCount: providers.length,
    },
    replay: {
      replayCount: execution.replayCount || 0,
      lastReplayAt: execution.lastReplayAt || null,
      errors: diagnostics?.errors?.length || 0,
    },
    envelopeSizeBytes: Buffer.byteLength(JSON.stringify(envelope), 'utf8'),
  }

  return snapshot
}

// ============================================================
// Observatory Storage — 内存存储，后续替换为持久化
// ============================================================

class ObservatoryStore {
  private snapshots: Map<string, ObservatorySnapshot> = new Map()
  private history: ObservatorySnapshot[] = []

  /** 记录一个快照 */
  record(snapshot: ObservatorySnapshot): void {
    this.snapshots.set(snapshot.executionId, snapshot)
    this.history.push(snapshot)
  }

  /** 获取最新快照 */
  getLatest(): ObservatorySnapshot | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null
  }

  /** 通过 executionId 获取 */
  getByExecution(executionId: string): ObservatorySnapshot | null {
    return this.snapshots.get(executionId) || null
  }

  /** 获取项目最近 N 条执行记录 */
  getByProject(projectId: string, limit = 10): ObservatorySnapshot[] {
    return this.history
      .filter((s) => s.projectId === projectId)
      .slice(-limit)
      .reverse()
  }

  /** 获取所有执行记录 */
  getHistory(limit = 50): ObservatorySnapshot[] {
    return this.history.slice(-limit).reverse()
  }

  /** 清除所有记录 */
  clear(): void {
    this.snapshots.clear()
    this.history = []
  }
}

export const observatoryStore = new ObservatoryStore()
