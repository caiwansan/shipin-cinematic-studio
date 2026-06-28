/**
 * decision-telemetry.ts — Decision Runtime Telemetry API
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-0.5: Decision Runtime Observatory Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Telemetry API 是所有 Agent 与 Runtime 交互的唯一观测入口。
 *
 * 强制规则：
 *   所有 Agent 必须通过 recordNodeStart / recordNodeFinish 包装。
 *   禁止 Agent 直接读写 Trace。
 *
 * @phase decision-runtime
 */

import type { DecisionTrace, TraceNodeExecution, TraceEvent } from './decision-trace.js'
// ============================================================
// 1. Telemetry Store（内存存储，未来可替换为 DB/Redis）
// ============================================================

interface TelemetryStore {
  traces: Map<string, DecisionTrace>
}

const store: TelemetryStore = {
  traces: new Map(),
}

// ============================================================
// 2. Telemetry API
// ============================================================

export const decisionTelemetry = {
  // ── Trace Lifecycle ──

  startTrace(rawInput: string): DecisionTrace {
    const trace = {
      traceId: `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      runtimeId: `dr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      rawInput,
      startedAt: new Date().toISOString(),
      nodes: [],
      events: [],
      status: 'running' as const,
    }
    store.traces.set(trace.traceId, trace)
    return trace
  },

  finishTrace(traceId: string, status: 'completed' | 'failed', error?: string): void {
    const trace = store.traces.get(traceId)
    if (!trace) return
    trace.finishedAt = new Date().toISOString()
    trace.status = status
    trace.durationMs = new Date(trace.finishedAt).getTime() - new Date(trace.startedAt).getTime()
    if (error) trace.error = error
  },

  // ── Node Lifecycle ──

  recordNodeStart(traceId: string, nodeType: string, inputSummary?: string): string {
    const trace = store.traces.get(traceId)
    if (!trace) return ''

    const nodeId = `node_${nodeType}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const exec: TraceNodeExecution = {
      nodeId,
      nodeType,
      startedAt: new Date().toISOString(),
      success: false,
      inputSummary,
    }
    trace.nodes.push(exec)
    return nodeId
  },

  recordNodeFinish(traceId: string, nodeId: string, success: boolean, error?: string, outputSummary?: string): void {
    const trace = store.traces.get(traceId)
    if (!trace) return

    const node = trace.nodes.find(n => n.nodeId === nodeId)
    if (!node) return

    node.finishedAt = new Date().toISOString()
    node.durationMs = new Date(node.finishedAt).getTime() - new Date(node.startedAt).getTime()
    node.success = success
    if (error) node.error = error
    if (outputSummary) node.outputSummary = outputSummary
  },

  // ── Events ──

  recordEvent(
    traceId: string,
    eventType: string,
    agentName: string,
    payload: Record<string, unknown>,
    durationMs?: number,
  ): void {
    const trace = store.traces.get(traceId)
    if (!trace) return

    const event: TraceEvent = {
      eventId: `evt_${trace.traceId}_${trace.events.length}`,
      eventType,
      timestamp: new Date().toISOString(),
      agentName,
      payload,
      durationMs,
    }
    trace.events.push(event)
  },

  // ── Export ──

  getTrace(traceId: string): DecisionTrace | undefined {
    return store.traces.get(traceId)
  },

  exportTrace(traceId: string): DecisionTrace | null {
    const trace = store.traces.get(traceId)
    if (!trace) return null
    return JSON.parse(JSON.stringify(trace)) // 深拷贝防变
  },

  listTraces(limit: number = 20): DecisionTrace[] {
    return Array.from(store.traces.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit)
  },
}
