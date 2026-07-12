// ============================================================
// C0-006: LearningConsumer — Publishing + DiscoverySignal → Learning 引擎
//
// 消费 DiscoverySignal + PublishingCompleted 事件
// 汇总整个事件链的结果，形成学习闭环
//
// 事件链：
//   PublishingCompleted + DiscoverySignal ↓
//   LearningConsumer (this) ↓
//   LearningRecord ↓
//   Knowledge Hub / Signal Quality / Provider Benchmark
// ============================================================

import type { DiscoveryConsumer } from './consumer-registry'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'

export interface LearningRecord {
  id: string
  projectId: string
  entityId: string
  executionId: string
  signals: {
    type: string
    provider: string
    confidence: number
    signalCount: number
    evidenceCount: number
  }[]
  publishingChannels: string[]
  signalQuality: {
    completeness: number
    costEfficiency: number
    overall: number
  }
  createdAt: string
  ingested: boolean
}

export class LearningConsumer implements DiscoveryConsumer {
  readonly name = 'LearningConsumer'

  /**
   * Learning 是最下游的消费者
   * 只要有 signals 就值得学习
   */
  supports(envelope: DiscoveryEnvelope): boolean {
    const signals = envelope.result.metadata.signals
    return signals !== undefined && signals.length > 0
  }

  async consume(envelope: DiscoveryEnvelope): Promise<void> {
    const entityName = envelope.result.entity.name
    const projectId = envelope.execution.projectId
    const signals = envelope.result.metadata.signals!

    console.log(`[LearningConsumer] Processing: ${entityName} (${projectId})`)

    // 汇总 Signal 信息
    const signalSummaries = signals.map((s) => ({
      type: s.type,
      provider: s.provider,
      confidence: s.confidence,
      signalCount: 1,
      evidenceCount: s.evidence.length,
    }))

    // 计算质量分
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
    const totalEvidence = signals.reduce((sum, s) => sum + s.evidence.length, 0)
    const completeness = Math.min(1, totalEvidence / Math.max(1, signals.length * 3))
    const costEfficiency = signals.length > 0 ? Math.min(1, (signals.length * 20) / (envelope.result.metadata.latencyMs || 1000)) : 0

    // 模拟计算 signal quality
    const record: LearningRecord = {
      id: `learning-${envelope.executionId}`,
      projectId,
      entityId: envelope.execution.entityId,
      executionId: envelope.executionId,
      signals: signalSummaries,
      publishingChannels: ['ai-feed', 'knowledge-hub'],
      signalQuality: {
        completeness: Math.round(completeness * 100) / 100,
        costEfficiency: Math.round(costEfficiency * 100) / 100,
        overall: Math.round((avgConfidence + completeness + costEfficiency) / 3 * 100) / 100,
      },
      createdAt: new Date().toISOString(),
      ingested: false,
    }

    learningStore.add(record)
    console.log(`[LearningConsumer] LearningRecord 已存储: ${record.id}`)
    console.log(`[LearningConsumer]   signals: ${signalSummaries.length}, quality: ${record.signalQuality.overall}`)

    // 如果 Quality 高于阈值，立即反馈到 Provider Benchmark
    if (record.signalQuality.overall >= 0.7) {
      console.log(`[LearningConsumer] ✅ Quality 达标，可反馈到 Provider Benchmark`)
    }
  }
}

export const learningConsumer = new LearningConsumer()

// ============================================================
// Learning Store — 内存存储
// ============================================================

class LearningStore {
  private records: LearningRecord[] = []

  add(record: LearningRecord): void {
    this.records.push(record)
  }

  getAll(): LearningRecord[] {
    return [...this.records]
  }

  count(): number {
    return this.records.length
  }

  getByProject(projectId: string): LearningRecord[] {
    return this.records.filter((r) => r.projectId === projectId)
  }
}

export const learningStore = new LearningStore()
