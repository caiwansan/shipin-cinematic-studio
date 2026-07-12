// ============================================================
// C0-003: MissionConsumer — Discovery → Mission 引擎
//
// 消费 Discovery + Recommendations 生成 ActionPlan
// 将 ActionPlan 提交到 Mission Queue
//
// 定位：
//   Mission 是执行引擎，不是分析引擎
//   MissionConsumer 只做三件事：
//     1. 收到 ActionPlan
//     2. 写入 Mission Repository
//     3. 入队 Mission Queue
//   不做：重新计算评分、重新分析缺口、重新排序
// ============================================================

import type { DiscoveryConsumer } from './consumer-registry'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'
import type { DiscoverySignal } from '../../domain/discovery-signal'
import type { ActionPlan, ActionItem, ActionPriority } from '../../domain/action-plan'
import { discoveryService } from './discovery.service'

/**
 * 根据 DiscoverySignal 生成 ActionPlan
 *
 * 当前版本：从 Signal 推断行动项
 * 未来版本：Recommendations 引擎生成经过排序的 ActionPlan
 *           MissionConsumer 只负责入队
 */
function buildActionPlan(envelope: DiscoveryEnvelope): ActionPlan | null {
  const signals = envelope.result.metadata.signals
  if (!signals || signals.length === 0) return null

  const entityName = envelope.result.entity.name
  const projectId = envelope.execution.projectId

  const actions: ActionItem[] = []
  let actionIdx = 0

  for (const signal of signals) {
    // presence signal 低 → 需要提升可见度
    if (signal.type === 'presence' && signal.confidence < 0.5) {
      actions.push({
        id: `action-${envelope.executionId}-${++actionIdx}`,
        title: `提升「${entityName}」在 ${signal.provider} 中的可见度`,
        description: `当前 presence confidence ${(signal.confidence * 100).toFixed(0)}%，建议优化该品牌在 ${signal.provider} 的知识覆盖`,
        priority: signal.confidence < 0.2 ? 'critical' : 'high',
        estimatedEffortMinutes: 60,
        estimatedImpact: Math.round((1 - signal.confidence) * 30),
        prerequisites: [],
        signalId: signal.id,
        provider: signal.provider,
        evidence: signal.evidence.map((e) => e.summary),
        source: 'recommendation',
      })
    }

    // knowledge signal 低 → 需要补充知识条目
    if (signal.type === 'knowledge' && signal.confidence < 0.4) {
      actions.push({
        id: `action-${envelope.executionId}-${++actionIdx}`,
        title: `补充「${entityName}」知识条目`,
        description: `当前 knowledge confidence ${(signal.confidence * 100).toFixed(0)}%，建议提交官方百科、维基百科或新闻报道`,
        priority: 'medium',
        estimatedEffortMinutes: 30,
        estimatedImpact: 15,
        prerequisites: [],
        signalId: signal.id,
        provider: signal.provider,
        source: 'recommendation',
      })
    }

    // search signal 有 recommendation 但 confidence 不高 → 优化搜索内容
    if (signal.type === 'search' && signal.confidence < 0.6 && signal.evidence.length > 0) {
      const bestEvidence = signal.evidence[0]?.summary || ''
      actions.push({
        id: `action-${envelope.executionId}-${++actionIdx}`,
        title: `优化「${entityName}」搜索内容: ${bestEvidence.slice(0, 30)}`,
        description: `基于 ${signal.provider} 的建议，优化相关内容以提高搜索可见度`,
        priority: signal.confidence < 0.3 ? 'high' : 'medium',
        estimatedEffortMinutes: 45,
        estimatedImpact: 10,
        prerequisites: [],
        signalId: signal.id,
        provider: signal.provider,
        evidence: signal.evidence.map((e) => e.summary),
        source: 'recommendation',
      })
    }
  }

  // 没有行动项 → 跳过
  if (actions.length === 0) return null

  // 排序：critical → high → medium → low
  const priorityOrder: Record<ActionPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  const plan: ActionPlan = {
    id: `plan-${envelope.executionId}`,
    projectId,
    entityId: envelope.execution.entityId,
    executionId: envelope.executionId,
    createdAt: new Date().toISOString(),
    objective: `提高「${entityName}」的 AI 可见度和知识覆盖`,
    actions,
    queued: false,
  }

  return plan
}

export class MissionConsumer implements DiscoveryConsumer {
  readonly name = 'MissionConsumer'

  supports(envelope: DiscoveryEnvelope): boolean {
    // Mission 需要至少有一个有意义的 signal
    const signals = envelope.result.metadata.signals
    if (!signals || signals.length === 0) return false

    // 至少有一个 signal 低于半置信 → 有行动项可生成
    return signals.some((s) => s.confidence < 0.5)
  }

  async consume(envelope: DiscoveryEnvelope): Promise<void> {
    console.log(`[MissionConsumer] Processing: ${envelope.result.entity.name}`)

    const plan = buildActionPlan(envelope)
    if (!plan) {
      console.log(`[MissionConsumer] 无需行动 — ${envelope.result.entity.name} 已处于良好状态`)
      return
    }

    // 入队 Mission Queue（当前为内存队列）
    missionQueue.enqueue(plan)

    // 标记 queued
    plan.queued = true

    console.log(`[MissionConsumer] ActionPlan 已入队: ${plan.id}, actions=${plan.actions.length}`)
    for (const action of plan.actions) {
      console.log(`  [${action.priority.toUpperCase()}] ${action.title} (影响: +${action.estimatedImpact})`)
    }
  }
}

export const missionConsumer = new MissionConsumer()

// ============================================================
// Mission Queue — 内存实现
// 后续可替换为 Redis / RabbitMQ / Kafka
// ============================================================

class MissionQueue {
  private queue: ActionPlan[] = []

  enqueue(plan: ActionPlan): void {
    this.queue.push(plan)
  }

  dequeue(): ActionPlan | undefined {
    return this.queue.shift()
  }

  peek(): ActionPlan | undefined {
    return this.queue[0]
  }

  size(): number {
    return this.queue.length
  }

  getAll(): ActionPlan[] {
    return [...this.queue]
  }
}

export const missionQueue = new MissionQueue()
