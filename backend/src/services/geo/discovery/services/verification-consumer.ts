// ============================================================
// C0-004: VerificationConsumer — Mission → Verification 引擎
//
// 仅监听 MissionCompleted 事件
// 将完成的 Mission 转化为 VerificationRequest
// 不直接接触 DiscoveryResult 或任何上游数据
//
// 事件链：
//   MissionCompleted ↓
//   VerificationConsumer (this) ↓
//   VerificationRequest ↓
//   Verification Engine
// ============================================================

import type { DiscoveryConsumer } from './consumer-registry'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'
import type { VerificationRequest, VerificationStatus } from '../../domain/verification-request'
import type { ActionPlan } from '../../domain/action-plan'

/**
 * Mission 完成状态 — 由 Mission Engine 在完成时通过事件传入
 * 当前简化版本：从 DiscoveryEnvelope 推断
 */
interface MissionCompletionStatus {
  missionId: string
  actionPlan: ActionPlan
  completedActions: string[]
  completedAt: string
}

export class VerificationConsumer implements DiscoveryConsumer {
  readonly name = 'VerificationConsumer'

  /**
   * VerificationConsumer 本应只消费 MissionCompleted 事件
   * 当前简化：通过 DiscoveryEnvelope 推断 Mission 已完成
   *
   * 后续版本：
   *   supports() 检查 MissionCompleteEvent (from EventBus)
   *   不再直接处理 DiscoveryEnvelope
   */
  supports(envelope: DiscoveryEnvelope): boolean {
    // 只要有 Mission 级别的 signal 且 completion > 0
    // 说明这个 discovery 已经产生了 actionable 的任务
    // 简化：如果有搜索类 signal（意味着已有优化动作）
    const signals = envelope.result.metadata.signals
    if (!signals || signals.length === 0) return false
    return signals.some((s) => s.type === 'search')
  }

  async consume(envelope: DiscoveryEnvelope): Promise<void> {
    const projectId = envelope.execution.projectId
    const entityName = envelope.result.entity.name
    const signals = envelope.result.metadata.signals!

    console.log(`[VerificationConsumer] Processing: ${entityName} (${projectId})`)

    // 从 signals 构建验证证据列表
    const evidenceList: { claimId: string; claim: string; expectedSource: string }[] = []

    for (const signal of signals) {
      for (const ev of signal.evidence) {
        evidenceList.push({
          claimId: signal.id,
          claim: ev.summary,
          expectedSource: ev.source || signal.provider,
        })
      }
    }

    // 构造 VerificationRequest
    const request: VerificationRequest = {
      id: `verification-${envelope.executionId}`,
      projectId,
      entityId: envelope.execution.entityId,
      executionId: envelope.executionId,
      missionId: `mission-${envelope.executionId}`,
      actionPlanId: `plan-${envelope.executionId}`,
      source: 'auto_mission',
      expectedOutcome: `「${entityName}」的 Discovery 结果经验证满足预期标准`,
      baselineReference: {
        description: `Discovery 执行时的快照 (execution: ${envelope.executionId})`,
        timestamp: envelope.execution.timestamp || new Date().toISOString(),
      },
      evidence: evidenceList,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    // 提交到验证队列
    verificationRequestQueue.enqueue(request)
    console.log(`[VerificationConsumer] VerificationRequest 已入队: ${request.id}`)
    console.log(`[VerificationConsumer]   evidence: ${evidenceList.length} items`)
    console.log(`[VerificationConsumer]   status: ${request.status}`)
  }
}

export const verificationConsumer = new VerificationConsumer()

// ============================================================
// Verification Request Queue
// 后续替换为持久化存储
// ============================================================

class VerificationRequestQueue {
  private queue: VerificationRequest[] = []

  enqueue(req: VerificationRequest): void {
    this.queue.push(req)
  }

  dequeue(): VerificationRequest | undefined {
    return this.queue.shift()
  }

  getAll(): VerificationRequest[] {
    return [...this.queue]
  }

  size(): number {
    return this.queue.length
  }

  updateStatus(id: string, status: VerificationStatus, score?: number, conclusion?: string): void {
    const req = this.queue.find((r) => r.id === id)
    if (req) {
      req.status = status
      if (score !== undefined) req.score = score
      if (conclusion !== undefined) req.conclusion = conclusion
      req.completedAt = new Date().toISOString()
    }
  }
}

export const verificationRequestQueue = new VerificationRequestQueue()
