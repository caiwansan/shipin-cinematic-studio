// ============================================================================
// 盘古斧 AI OS — Phase 7A-STABILIZE Event Ordering Lock
// 核心规则：没有事件的逻辑时间戳，任何事件不可发出
// DAG 执行 → LogicalClock → SSE emission → UI render 顺序严格一致
// ============================================================================

import { createHash } from 'crypto'

// ── 逻辑时钟（单调递增，而非 wall clock） ──────────────────────────────

class LogicalClock {
  private _ticks = 0
  private dagCounter = 0

  get ticks(): number { return this._ticks }

  /** 自增并返回不可跳过的下一个 tick */
  next(): number {
    this._ticks++
    return this._ticks
  }

  /** DAG 执行流水号（每个 DAG run 唯一递增） */
  nextDAGId(): string {
    this.dagCounter++
    return `dag_${this._ticks}_${this.dagCounter}`
  }

  /** 同步 tick（用于 replay 时锁定到相同序列） */
  syncTo(tick: number): void {
    if (tick <= this._ticks) {
      throw new Error(`LogicalClock: cannot sync to ${tick} — current ${this._ticks} is already ahead`)
    }
    this._ticks = tick
  }

  /** 回退到指定 tick（仅用于 replay 模式——强制锁定到原始序列的 tick） */
  resetTo(tick: number): void {
    this._ticks = tick
  }

  reset(): void {
    this._ticks = 0
    this.dagCounter = 0
  }
}

export const logicalClock = new LogicalClock()

// ── 事件载荷（带时间戳锚定） ────────────────────────────────────────────

export interface AnchoredEvent {
  type: string
  tick: number          // logical clock tick（严格单调）
  dagId: string         // 所属 DAG run
  nodeId?: string       // DAG 节点内序号
  timestamp: string     // ISO 字符串（仅用于显示，不用于排序）
  data: Record<string, unknown>
  traceId: string       // 每个事件必须有 traceId
  hash: string          // SHA256 锚定
}

// ── 事件排序锁 ──────────────────────────────────────────────────────────

export class EventOrderingLock {
  private emittedAtTick = new Map<string, number>()  // traceId → lastTick
  private dagEventSequences = new Map<string, AnchoredEvent[]>()  // dagId → events

  /** 验证事件是否可以发出 */
  canEmit(event: Partial<AnchoredEvent>): { allowed: boolean; reason?: string } {
    // RULE 1: 必须有逻辑时间戳
    if (event.tick === undefined || event.tick === null) {
      return { allowed: false, reason: 'MISSING_LOGICAL_TIMESTAMP' }
    }

    // RULE 2: 必须有 traceId
    if (!event.traceId) {
      return { allowed: false, reason: 'MISSING_TRACE_ID' }
    }

    // RULE 3: 同一 traceId 内 tick 必须递增（防止乱序）
    const lastTick = this.emittedAtTick.get(event.traceId)
    if (lastTick !== undefined && event.tick <= lastTick) {
      return {
        allowed: false,
        reason: `OUT_OF_ORDER: tick ${event.tick} <= last ${lastTick} for trace ${event.traceId}`
      }
    }

    return { allowed: true }
  }

  /** 锚定事件（记录 + 锁定） */
  anchor(event: AnchoredEvent): AnchoredEvent {
    // 记录已发射
    this.emittedAtTick.set(event.traceId, event.tick)

    // 记录 DAG 序列
    const seq = this.dagEventSequences.get(event.dagId) || []
    seq.push(event)
    this.dagEventSequences.set(event.dagId, seq)

    return event
  }

  /** 获取 DAG run 的完整事件序列（用于 replay 比较） */
  getDAGSequence(dagId: string): AnchoredEvent[] {
    return this.dagEventSequences.get(dagId) || []
  }

  /** 比较两个 DAG run 的事件序列是否一致 */
  compareSequences(dagIdA: string, dagIdB: string): { match: boolean; diff?: string } {
    const seqA = this.getDAGSequence(dagIdA)
    const seqB = this.getDAGSequence(dagIdB)

    if (seqA.length !== seqB.length) {
      return { match: false, diff: `Sequence length mismatch: ${seqA.length} vs ${seqB.length}` }
    }

    for (let i = 0; i < seqA.length; i++) {
      if (seqA[i].hash !== seqB[i].hash) {
        return {
          match: false,
          diff: `Event ${i} hash mismatch: ${seqA[i].hash} vs ${seqB[i].hash}`
        }
      }
    }

    return { match: true }
  }

  /** 清除历史（避免内存泄漏） */
  clearDAG(dagId: string): void {
    // '*' 清理所有
    if (dagId === '*') {
      this.dagEventSequences.clear()
      this.emittedAtTick.clear()
      return
    }
    this.dagEventSequences.delete(dagId)
  }

  /** 重置序列跟踪（用于 replay 的前序准备） */
  resetForReplay(): void {
    // 不清除历史，只清除 per-trace 的 ordering 状态
    // 这样 replay 可以重新发射相同 tick 的事件
    this.emittedAtTick.clear()
  }
}

export const eventOrderingLock = new EventOrderingLock()

// ── 哈希工具 ────────────────────────────────────────────────────────────

export function hashEvent(event: Omit<AnchoredEvent, 'hash'>): string {
  const canonical = JSON.stringify({
    type: event.type,
    tick: event.tick,
    dagId: event.dagId,
    nodeId: event.nodeId,
    traceId: event.traceId,
    data: event.data
  })
  return createHash('sha256').update(canonical).digest('hex')
}

export function hashEventSequence(events: AnchoredEvent[]): string {
  const hasher = createHash('sha256')
  for (const event of events) {
    hasher.update(event.hash)
  }
  return hasher.digest('hex')
}
