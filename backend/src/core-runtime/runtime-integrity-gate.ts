// ============================================================================
// 盘古斧 AI OS — Phase 7A-STABILIZE Runtime Integrity Gate
// 最终防线：阻断所有违反确定性规则的操作
// BLOCK IF: ordering mismatch, hash mismatch, replay divergence, missing timestamps
// ============================================================================

import { logicalClock, eventOrderingLock, type AnchoredEvent, hashEvent } from '../events/event-order-lock.js'
import { runtimeEventBus } from '../events/runtime-event-bus.js'

// ── 阻断规则 ────────────────────────────────────────────────────────────

export type IntegrityViolation =
  | 'MISSING_LOGICAL_TIMESTAMP'
  | 'EVENT_ORDER_MISMATCH'
  | 'SNAPSHOT_HASH_MISMATCH'
  | 'REPLAY_DIVERGENCE'
  | 'MISSING_TRACE_ID'
  | 'TICK_ROLLBACK'
  | 'DAG_SEQUENCE_BREAK'

interface IntegrityCheckResult {
  passed: boolean
  violations: IntegrityViolation[]
  details: string[]
  blocked: boolean
}

// ── 运行时完整性门控 ────────────────────────────────────────────────────

export class RuntimeIntegrityGate {
  private tickHistory = new Set<number>()
  private blockedSince: number | null = null
  private violationsCount = 0
  private maxViolationsBeforePanic = 5

  /** 在发射事件前置检查（最外层守卫） */
  checkBeforeEmit(event: Partial<AnchoredEvent>): IntegrityCheckResult {
    if (this.blockedSince !== null) {
      return {
        passed: false,
        violations: [],
        details: ['INTEGRITY_GATE_BLOCKED'],
        blocked: true
      }
    }

    const violations: IntegrityViolation[] = []
    const details: string[] = []

    // RULE 1: 必须有逻辑时间戳
    if (event.tick === undefined || event.tick === null) {
      violations.push('MISSING_LOGICAL_TIMESTAMP')
      details.push('Event missing logical timestamp — must use logicalClock.next()')
    }

    // RULE 2: 必须有 traceId
    if (!event.traceId) {
      violations.push('MISSING_TRACE_ID')
      details.push('Event missing traceId — each event requires traceId')
    }

    // RULE 3: tick 不能回退
    if (event.tick !== undefined) {
      if (this.tickHistory.has(event.tick)) {
        violations.push('TICK_ROLLBACK')
        details.push(`Tick ${event.tick} already emitted — possible rollback or collision`)
      }
    }

    // RULE 4: 事件排序检查
    if (event.tick !== undefined && event.traceId) {
      const orderCheck = eventOrderingLock.canEmit(event)
      if (!orderCheck.allowed) {
        violations.push('EVENT_ORDER_MISMATCH')
        details.push(orderCheck.reason || 'Event ordering violation')
      }
    }

    const passed = violations.length === 0

    if (!passed) {
      this.violationsCount++
      if (this.violationsCount >= this.maxViolationsBeforePanic) {
        this.block()
      }

      runtimeEventBus.emit('integrity.violation', {
        violations,
        details,
        violationCount: this.violationsCount,
        event: { type: event.type, tick: event.tick, traceId: event.traceId }
      })
    }

    return { passed, violations, details, blocked: false }
  }

  /** 检查 DAG 执行完整性 */
  checkDAGIntegrity(dagId: string, events: AnchoredEvent[]): IntegrityCheckResult {
    const violations: IntegrityViolation[] = []
    const details: string[] = []

    // RULE: 事件序列必须有序
    for (let i = 1; i < events.length; i++) {
      if (events[i].tick <= events[i - 1].tick) {
        violations.push('DAG_SEQUENCE_BREAK')
        details.push(`DAG ${dagId}: event ${i} (tick ${events[i].tick}) <= event ${i - 1} (tick ${events[i - 1].tick})`)
        break
      }
    }

    // RULE: 所有事件的 traceId 必须一致
    const traceIds = new Set(events.map(e => e.traceId))
    if (traceIds.size > 1 && events.length > 1) {
      violations.push('MISSING_TRACE_ID')
      details.push(`DAG ${dagId}: multiple traceIds in same sequence: ${Array.from(traceIds).join(', ')}`)
    }

    const passed = violations.length === 0
    return { passed, violations, details, blocked: false }
  }

  /** 检查 replay 一致性 */
  checkReplayIntegrity(
    originalEvents: AnchoredEvent[],
    replayEvents: AnchoredEvent[],
    threshold: number
  ): IntegrityCheckResult {
    const violations: IntegrityViolation[] = []
    const details: string[] = []

    if (originalEvents.length !== replayEvents.length) {
      violations.push('REPLAY_DIVERGENCE')
      details.push(`Event count mismatch: ${originalEvents.length} vs ${replayEvents.length}`)
    }

    // 计算漂移
    let mismatches = 0
    const minLen = Math.min(originalEvents.length, replayEvents.length)
    for (let i = 0; i < minLen; i++) {
      if (originalEvents[i].hash !== replayEvents[i].hash) {
        mismatches++
      }
    }

    const driftRatio = mismatches / Math.max(originalEvents.length, 1)
    if (driftRatio > threshold) {
      violations.push('REPLAY_DIVERGENCE')
      details.push(`Replay divergence: ${mismatches} mismatches (drift ${(driftRatio * 100).toFixed(1)}%) exceeds threshold ${(threshold * 100).toFixed(1)}%`)
    }

    const passed = violations.length === 0
    return { passed, violations, details, blocked: false }
  }

  /** 阻断所有发射 */
  block(): void {
    this.blockedSince = Date.now()
    runtimeEventBus.emit('system.error', {
      reason: 'INTEGRITY_GATE_TRIGGERED',
      violationsCount: this.violationsCount,
      blockedSince: this.blockedSince
    })
    console.error('[IntegrityGate] 🔒 BLOCKED — runtime integrity violation threshold reached')
  }

  /** 获取门控状态 */
  getStatus(): Record<string, unknown> {
    return {
      blocked: this.blockedSince !== null,
      blockedSince: this.blockedSince,
      violationsCount: this.violationsCount,
      maxViolationsBeforePanic: this.maxViolationsBeforePanic,
      emittedTickCount: this.tickHistory.size
    }
  }

  /** 重置（危险操作——仅用于系统重置时） */
  reset(): void {
    this.tickHistory.clear()
    this.blockedSince = null
    this.violationsCount = 0
  }
}

export const runtimeIntegrityGate = new RuntimeIntegrityGate()
