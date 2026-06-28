/**
 * Replay Data Emitter
 * 回放数据发射器 — 将 trace 流推送给前端
 *
 * 支持两种传输方式：
 *   1. SSE（主要） — GET /api/workbench/replay/stream/:traceId
 *   2. WebSocket（备选）
 *
 * 发射流程：
 *   traceCollector.emit() → replayEmitter.broadcast() → SSE → 前端 Store
 *
 * 消息格式（SSE）：
 *   event: trace
 *   data: { seq, layer, type, payload }
 *
 *   event: snapshot
 *   data: { seq, snapshot }
 *
 *   event: status
 *   data: { total, current, progress }
 */

import { Response } from 'express'
import { traceCollector } from './director-trace-collector'
import { DirectorTraceEvent, TraceLayer, TraceStateSnapshot } from './director-trace-types'

// ─── SSE 连接管理 ──────────────────────────────────

const clients = new Map<string, Set<Response>>()

function getClientSet(traceId: string): Set<Response> {
  if (!clients.has(traceId)) {
    clients.set(traceId, new Set())
  }
  return clients.get(traceId)!
}

/**
 * 注册 SSE 连接
 */
function registerSSE(traceId: string, res: Response): void {
  const set = getClientSet(traceId)
  set.add(res)

  res.on('close', () => {
    set.delete(res)
    if (set.size === 0) {
      clients.delete(traceId)
    }
  })
}

/**
 * 广播单条 trace 事件（由 collector.emit 内部调用）
 */
function broadcast(
  traceId: string,
  event: DirectorTraceEvent,
): void {
  const set = clients.get(traceId)
  if (!set || set.size === 0) return

  const payload = JSON.stringify({
    seq: event.seq,
    layer: event.layer,
    type: event.type,
    payload: event.payload,
  })

  for (const res of set) {
    try {
      res.write(`event: trace\ndata: ${payload}\n\n`)
    } catch {
      set.delete(res)
    }
  }
}

/**
 * 广播快照（finalize 时使用）
 */
function broadcastSnapshot(
  traceId: string,
  seq: number,
  snapshot: TraceStateSnapshot,
): void {
  const set = clients.get(traceId)
  if (!set || set.size === 0) return

  const payload = JSON.stringify({ seq, snapshot })

  for (const res of set) {
    try {
      res.write(`event: snapshot\ndata: ${payload}\n\n`)
    } catch {
      set.delete(res)
    }
  }
}

/**
 * 广播状态更新
 */
function broadcastStatus(traceId: string): void {
  const status = traceCollector.getStatus(traceId)
  if (!status) return

  const set = clients.get(traceId)
  if (!set || set.size === 0) return

  const payload = JSON.stringify(status)

  for (const res of set) {
    try {
      res.write(`event: status\ndata: ${payload}\n\n`)
    } catch {
      set.delete(res)
    }
  }
}

/**
 * 完成广播（关闭所有连接）
 */
function broadcastDone(traceId: string): void {
  const set = clients.get(traceId)
  if (!set) return

  for (const res of set) {
    try {
      res.write(`event: done\ndata: {}\n\n`)
      res.end()
    } catch {
      // ignore
    }
  }
  clients.delete(traceId)
}

export const replayEmitter = {
  registerSSE,
  broadcast,
  broadcastSnapshot,
  broadcastStatus,
  broadcastDone,
}
