/**
 * Director Trace Collector
 * 导演追踪收集器 — 五根支柱的 Trace 事件收集与缓冲器
 *
 * 职责：
 *   1. 从五个 API handler 中接收 emit 调用
 *   2. 按 traceId 分组缓冲区
 *   3. 提供快照构建功能（用于 Replay）
 *   4. 当 trace 完成后自动构建状态快照序列
 */

import {
  DirectorTraceEvent,
  TraceLayer,
  TraceStateSnapshot,
  ReplayStatus,
} from './director-trace-types'
import { replayEmitter } from './replay-data-emitter'

// ─── 内存缓冲区（单进程，多 trace 共存） ──────────────

const traceBuffers = new Map<string, DirectorTraceEvent[]>()
const traceSnapshots = new Map<string, TraceStateSnapshot[]>()
const traceStatuses = new Map<string, ReplayStatus>()
let globalSeq = 0

// ─── Collector ─────────────────────────────────────

function emit(
  layer: TraceLayer,
  type: string,
  payload: any,
  traceId?: string,
): string {
  const id = traceId ?? `trace_${Date.now()}`
  const event: DirectorTraceEvent = {
    traceId: id,
    timestamp: Date.now(),
    layer,
    type,
    payload,
    seq: globalSeq++,
  }

  if (!traceBuffers.has(id)) {
    traceBuffers.set(id, [])
  }
  traceBuffers.get(id)!.push(event)

  // 更新 status
  const buf = traceBuffers.get(id)!
  traceStatuses.set(id, {
    traceId: id,
    totalEvents: -1, // 未知，直到 finalize
    currentSeq: event.seq,
    progress: 0,
    layers: [...new Set(buf.map(e => e.layer))],
    timestamps: {
      start: buf[0]?.timestamp ?? Date.now(),
      end: Date.now(),
    },
  })

  // 同步广播给 SSE 客户端
  replayEmitter.broadcast(id, event)

  return id
}

/**
 * 标记 trace 完成，构建快照序列
 */
function finalize(
  traceId: string,
  snapshotBuilder: (events: DirectorTraceEvent[]) => TraceStateSnapshot[],
): void {
  const buf = traceBuffers.get(traceId)
  if (!buf) return

  const snapshots = snapshotBuilder(buf)
  traceSnapshots.set(traceId, snapshots)

  // 广播最终快照
  for (let i = 0; i < snapshots.length; i++) {
    replayEmitter.broadcastSnapshot(traceId, i, snapshots[i])
  }
  replayEmitter.broadcastDone(traceId)

  traceStatuses.set(traceId, {
    traceId,
    totalEvents: buf.length,
    currentSeq: buf[buf.length - 1]?.seq ?? 0,
    progress: 1,
    layers: [...new Set(buf.map(e => e.layer))],
    timestamps: {
      start: buf[0]?.timestamp ?? Date.now(),
      end: Date.now(),
    },
  })
}

/**
 * 获取 trace 的事件流
 */
function getEvents(traceId: string): DirectorTraceEvent[] {
  return traceBuffers.get(traceId) ?? []
}

/**
 * 获取 trace 的快照序列
 */
function getSnapshots(traceId: string): TraceStateSnapshot[] {
  return traceSnapshots.get(traceId) ?? []
}

/**
 * 获取 trace 状态
 */
function getStatus(traceId: string): ReplayStatus | null {
  return traceStatuses.get(traceId) ?? null
}

/**
 * 生成默认快照序列（基于事件的时间顺序分组）
 * 每 N 个事件生成一个快照点
 */
function buildDefaultSnapshots(
  events: DirectorTraceEvent[],
  groupSize: number = 3,
): TraceStateSnapshot[] {
  const snapshots: TraceStateSnapshot[] = []
  const groups = []
  for (let i = 0; i < events.length; i += groupSize) {
    groups.push(events.slice(0, i + groupSize))
  }

  for (const group of groups) {
    const timeline: any[] = []
    const emotionalCurve: any[] = []
    const motionEnergyFlow: number[] = []

    for (const e of group) {
      if (e.layer === 'shot' && e.type === 'SHOT_COMPILED') {
        timeline.push(e.payload)
      }
      if (e.layer === 'grammar' && e.type === 'EMOTION_COMPUTED') {
        emotionalCurve.push(e.payload)
      }
      if (e.layer === 'motion' && e.type === 'MOTION_INTENT_COMPUTED') {
        motionEnergyFlow.push(e.payload?.energyFlow ?? 0)
      }
    }

    snapshots.push({
      timeline,
      emotionalCurve,
      motionEnergyFlow,
      grammarGraph: null,
      characterStates: null,
      temporalContinuity: [],
    })
  }

  return snapshots
}

/**
 * 清理过期 trace（防止内存泄漏）
 */
function cleanup(maxAgeMs: number = 10 * 60 * 1000): void {
  const now = Date.now()
  for (const [id, buf] of traceBuffers) {
    const age = now - (buf[buf.length - 1]?.timestamp ?? now)
    if (age > maxAgeMs) {
      traceBuffers.delete(id)
      traceSnapshots.delete(id)
      traceStatuses.delete(id)
    }
  }
}

export const traceCollector = {
  emit,
  finalize,
  getEvents,
  getSnapshots,
  getStatus,
  buildDefaultSnapshots,
  cleanup,
}
