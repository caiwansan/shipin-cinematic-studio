/**
 * decision-observer.ts — Decision Runtime Observer
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-0.5: Decision Runtime Observatory Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Observer 是 Runtime 执行的可观测性外观层。
 * 它包装 Telemetry API，对外提供统一的可观测性接口。
 *
 * Observer 负责：
 *   1. 生成可读的执行摘要
 *   2. 提供执行状态的实时查询
 *   3. 格式化 Trace 供审计/回放使用
 *
 * @phase decision-runtime
 */

import { decisionTelemetry } from './decision-telemetry.js'
import type { DecisionTrace } from './decision-trace.js'

// ============================================================
// 1. Observer API
// ============================================================

export const decisionObserver = {
  // ── 实时状态查询 ──

  getStatus(traceId: string): { status: string; progress: string; elapsedMs: number } | null {
    const trace = decisionTelemetry.getTrace(traceId)
    if (!trace) return null

    const elapsedMs = trace.finishedAt
      ? new Date(trace.finishedAt).getTime() - new Date(trace.startedAt).getTime()
      : Date.now() - new Date(trace.startedAt).getTime()

    const completedNodes = trace.nodes.filter(n => n.finishedAt).length
    const totalNodes = trace.nodes.length
    const progress = totalNodes > 0 ? `${completedNodes}/${totalNodes}` : 'initializing'

    return {
      status: trace.status,
      progress,
      elapsedMs,
    }
  },

  // ── 生成可读摘要 ──

  summarizeTrace(traceId: string): string | null {
    const trace = decisionTelemetry.getTrace(traceId)
    if (!trace) return null

    const lines: string[] = [
      `━━━ Decision Trace ━━━`,
      `Trace ID: ${trace.traceId}`,
      `状态: ${trace.status === 'completed' ? '✅ 完成' : trace.status === 'failed' ? '❌ 失败' : '⏳ 运行中'}`,
      `原始输入: ${trace.rawInput.slice(0, 100)}${trace.rawInput.length > 100 ? '...' : ''}`,
      `耗时: ${trace.durationMs ? `${trace.durationMs}ms` : '进行中'}`,
      ``,
      `节点执行 (${trace.nodes.length}):`,
    ]

    for (const node of trace.nodes) {
      const icon = node.success ? '✅' : node.finishedAt ? '❌' : '⏳'
      const duration = node.durationMs ? ` [${node.durationMs}ms]` : ''
      const err = node.error ? ` — ${node.error}` : ''
      lines.push(`  ${icon} ${node.nodeType}${duration}${err}`)
    }

    if (trace.events.length > 0) {
      lines.push(``, `事件日志 (${trace.events.length}):`)
      for (const evt of trace.events.slice(-10)) {
        lines.push(`  📍 ${evt.eventType} — ${evt.agentName}`)
      }
    }

    if (trace.error) {
      lines.push(``, `❌ 错误: ${trace.error}`)
    }

    return lines.join('\n')
  },

  // ── 导出为审计格式 ──

  toAuditLog(traceId: string): Record<string, unknown> | null {
    const trace = decisionTelemetry.getTrace(traceId)
    if (!trace) return null

    return {
      auditId: `audit_${trace.traceId}`,
      timestamp: trace.finishedAt || trace.startedAt,
      runtimeType: 'decision-runtime',
      input: trace.rawInput.slice(0, 500),
      status: trace.status,
      durationMs: trace.durationMs,
      nodeCount: trace.nodes.length,
      eventCount: trace.events.length,
      errors: trace.nodes.filter(n => n.error).map(n => ({
        node: n.nodeType,
        error: n.error,
      })),
    }
  },
}
