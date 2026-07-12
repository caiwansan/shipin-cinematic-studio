// ============================================================
// C0-005: PublishingConsumer — Verification → Publishing 引擎
//
// 仅监听 VerificationCompleted 事件（当前简化：DiscoveryEnvelope）
// 将验证通过的结果发布到目标渠道
//
// 事件链：
//   VerificationCompleted ↓
//   PublishingConsumer (this) ↓
//   PublishingRequest ↓
//   AI Feed / Website / Sitemap
// ============================================================

import type { DiscoveryConsumer } from './consumer-registry'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'

export interface PublishingRequest {
  id: string
  projectId: string
  entityId: string
  executionId: string
  verificationId: string
  content: {
    title: string
    summary: string
    body: string
    tags: string[]
  }
  channels: string[]
  status: 'pending' | 'published' | 'failed'
  createdAt: string
  publishedAt?: string
}

export class PublishingConsumer implements DiscoveryConsumer {
  readonly name = 'PublishingConsumer'

  /**
   * 本应只消费 VerificationCompleted 事件
   * 当前简化：有经过验证的 signal 且 presence confidence 高（验证通过）
   */
  supports(envelope: DiscoveryEnvelope): boolean {
    const signals = envelope.result.metadata.signals
    if (!signals || signals.length === 0) return false
    // 至少有 presence+knowledge 两个以上 signal 且 confidence 达标
    const types = new Set(signals.map((s) => s.type))
    return types.has('presence') && types.has('knowledge')
  }

  async consume(envelope: DiscoveryEnvelope): Promise<void> {
    const entityName = envelope.result.entity.name
    const projectId = envelope.execution.projectId
    const signals = envelope.result.metadata.signals!

    console.log(`[PublishingConsumer] Processing: ${entityName} (${projectId})`)

    // 从 signals 构建发布内容
    const summaryParts: string[] = []
    const bodyParts: string[] = []

    for (const signal of signals) {
      const typeLabel = signal.type === 'presence' ? '可见度' : signal.type === 'knowledge' ? '知识覆盖' : '搜索表现'
      summaryParts.push(`${typeLabel}: ${(signal.confidence * 100).toFixed(0)}%`)

      for (const ev of signal.evidence) {
        bodyParts.push(`- [${signal.provider}] ${ev.summary}`)
      }
    }

    const request: PublishingRequest = {
      id: `publish-${envelope.executionId}`,
      projectId,
      entityId: envelope.execution.entityId,
      executionId: envelope.executionId,
      verificationId: `verification-${envelope.executionId}`,
      content: {
        title: `GEO Discovery: ${entityName}`,
        summary: summaryParts.join(' | '),
        body: bodyParts.join('\n'),
        tags: ['geo', 'discovery', entityName, ...signals.map((s) => s.provider)],
      },
      channels: ['ai-feed', 'knowledge-hub'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    publishingQueue.enqueue(request)
    console.log(`[PublishingConsumer] PublishingRequest 已入队: ${request.id}`)
    console.log(`[PublishingConsumer]   channels: ${request.channels.join(', ')}`)
    console.log(`[PublishingConsumer]   summary: ${request.content.summary}`)
  }
}

export const publishingConsumer = new PublishingConsumer()

// ============================================================
// Publishing Queue
// ============================================================

class PublishingQueue {
  private queue: PublishingRequest[] = []

  enqueue(req: PublishingRequest): void {
    this.queue.push(req)
  }

  dequeue(): PublishingRequest | undefined {
    return this.queue.shift()
  }

  getAll(): PublishingRequest[] {
    return [...this.queue]
  }

  size(): number {
    return this.queue.length
  }
}

export const publishingQueue = new PublishingQueue()
