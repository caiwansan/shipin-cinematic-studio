// ============================================================================
// 盘古斧 AI OS — Phase 7A-STABILIZE Runtime Event Bus (重构版)
// 注入：Event Ordering Lock + Backpressure + Integrity Gate
// 所有事件发出前必须经过三层检查
// ============================================================================

import { LogicalClock, EventOrderingLock, AnchoredEvent, hashEvent, logicalClock, eventOrderingLock } from './event-order-lock.js'
import { backpressureController } from './backpressure-controller.js'
import { runtimeIntegrityGate } from '../core-runtime/runtime-integrity-gate.js'
import { replayDeterminismEngine } from '../core-runtime/replay-determinism-engine.js'
import { snapshotAnchorSystem } from '../core-runtime/snapshot-anchor.js'
import { eventDrivenHealth } from '../health/event-driven-health.js'
// ═══ Phase 8.3: Distributed Runtime State ═══
import { appendRuntimeEvent } from '../core-runtime/distributed/runtime-state-journal.js'
import { nextVersion } from '../core-runtime/distributed/version-clock.js'

type EventType =
  | 'runtime.status'
  | 'dag.execute'
  | 'dag.complete'
  | 'dag.error'
  | 'trace.node'
  | 'replay.start'
  | 'replay.complete'
  | 'replay.drift'
  | 'replay.compare'
  | 'repair.trigger'
  | 'repair.complete'
  | 'health.update'
  | 'governance.action'
  | 'system.warning'
  | 'system.error'
  | 'snapshot.anchor'
  | 'snapshot.fork'
  | 'snapshot.verify'
  | 'integrity.violation'

interface RuntimeEvent {
  type: EventType
  tick: number
  timestamp: string
  data: Record<string, unknown>
  traceId?: string
  hash: string
}

type EventListener = (event: AnchoredEvent) => void

class StabilizedEventBus {
  private listeners: Map<string, Set<EventListener>> = new Map()
  private history: AnchoredEvent[] = []
  private maxHistory = 500
  private healthTickInterval: ReturnType<typeof setInterval> | null = null

  get totalTicks(): number { return logicalClock.ticks }
  get totalEvents(): number { return this.history.length }
  /** Phase 8.2a: Backpressure tier exposure */
  get backpressureTier(): string {
    const bp = backpressureController.getStatus()
    return bp?.tier || 'LIGHT'
  }

  /** 发射事件（经过 Integrity Gate → Ordering Lock → Backpressure → SSE） */
  emit(type: EventType, data: Record<string, unknown>, traceId?: string): AnchoredEvent | null {
    const tick = logicalClock.next()
    const dagId = data.dagId as string || `auto_${tick}`

    const rawEvent = {
      type,
      tick,
      dagId,
      nodeId: data.nodeId as string | undefined,
      timestamp: new Date().toISOString(),
      data,
      traceId: traceId || `trace_${tick}`
    }

    const event: AnchoredEvent = {
      ...rawEvent,
      hash: hashEvent(rawEvent)
    }

    // ── Integrity Gate（最外层防线） ─────────────────────────────
    const gateCheck = runtimeIntegrityGate.checkBeforeEmit(event)
    if (!gateCheck.passed || gateCheck.blocked) {
      console.error(`[EventBus] 🚫 BLOCKED by Integrity Gate: ${gateCheck.violations.join(', ')}`)
      return null
    }

    // ── Event Ordering Lock ──────────────────────────────────────
    const orderCheck = eventOrderingLock.canEmit(event)
    if (!orderCheck.allowed) {
      console.error(`[EventBus] 🚫 OUT OF ORDER: ${orderCheck.reason}`)
      return null
    }

    eventOrderingLock.anchor(event)

    // ── Backpressure ─────────────────────────────────────────────
    const bpResult = backpressureController.push(event)
    if (!bpResult.accepted) {
      // 背压丢弃
      return null
    }

    // ── 通知监听者 ───────────────────────────────────────────────
    const handlers = this.listeners.get(type)
    if (handlers) {
      handlers.forEach(h => h(event))
    }
    const allHandlers = this.listeners.get('*')
    if (allHandlers) {
      allHandlers.forEach(h => h(event))
    }

    // ── 保存历史 ─────────────────────────────────────────────────
    this.history.push(event)
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, this.history.length - this.maxHistory)
    }

    // ═══ Phase 8.3: Runtime State Journal Hook ═══
    // 将关键事件类型自动写入 journal
    const journalType = this.eventTypeToJournalType(type)
    if (journalType) {
      appendRuntimeEvent(
        (data.tenantId as string) || 'system',
        dagId,
        journalType,
        {
          type,
          tick: event.tick,
          eventId: event.hash,
          traceId: event.traceId,
          data,
          version: nextVersion(dagId),
        },
      )
    }

    return event
  }

  /** 订阅事件 */
  on(type: EventType | '*', listener: EventListener): () => void {
    const key = type as string
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key)!.add(listener)
    return () => this.listeners.get(key)?.delete(listener)
  }

  /** 获取事件历史（按顺序） */
  getHistory(types?: EventType[], limit = 50): AnchoredEvent[] {
    let events = this.history
    if (types && types.length > 0) {
      events = events.filter(e => types.includes(e.type as EventType))
    }
    return events.slice(-limit)
  }

  /** 启动事件驱动的健康计算心跳（替代 timer-based） */
  startHealthComputation(intervalMs = 5000): void {
    if (this.healthTickInterval) clearInterval(this.healthTickInterval)

    this.healthTickInterval = setInterval(() => {
      const events = this.history.slice(-100)
      eventDrivenHealth.tick(events)
    }, intervalMs)

    console.log(`[Health] Event-driven health computation started (every ${intervalMs}ms)`)
  }

  /** ═══ Phase 8.3: Map EventBus event type to journal event type ═══ */
  private eventTypeToJournalType(
    type: EventType,
  ): import('../core-runtime/distributed/runtime-state-journal.js').JournalEventType | null {
    switch (type) {
      case 'dag.execute':
        return 'TASK_STARTED'
      case 'dag.complete':
        return 'DAG_COMPLETED'
      case 'dag.error':
        return 'TASK_FAILED'
      case 'trace.node':
        return 'TASK_COMPLETED'
      case 'snapshot.anchor':
        return 'SNAPSHOT_CREATED'
      default:
        return null
    }
  }

  /** 重置 */
  reset(): void {
    this.listeners.clear()
    this.history = []
    logicalClock.reset()
    eventOrderingLock.clearDAG('*')
    backpressureController.reset()
    runtimeIntegrityGate.reset()
    eventDrivenHealth.reset()
    if (this.healthTickInterval) {
      clearInterval(this.healthTickInterval)
      this.healthTickInterval = null
    }
  }

  /** 系统状态快照 */
  getStatusSnapshot(): Record<string, unknown> {
    const health = eventDrivenHealth.getLastHealth()
    return {
      totalTicks: logicalClock.ticks,
      totalEvents: this.history.length,
      health: health ? { score: health.healthScore, tier: health.loadTier, zone: health.operatingZone } : null,
      backpressure: backpressureController.getStatus(),
      integrityGate: runtimeIntegrityGate.getStatus(),
      uptime: process.uptime()
    }
  }
}

export const runtimeEventBus = new StabilizedEventBus()
export type { RuntimeEvent, EventType, EventListener }
