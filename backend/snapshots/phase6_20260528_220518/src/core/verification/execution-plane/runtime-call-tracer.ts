/**
 * EPVH — RuntimeCallTracer（运行时调用追踪器）
 *
 * 注入 hook 追踪所有 execution 路径。
 * 记录从请求到 provider 的完整调用链。
 *
 * ═══ 宪法 ═══
 * 运行时追踪是非侵入的（不改变执行语义）。
 * 所有 execution 必须可被追踪。
 */

import { Capability } from '../../runtime/capabilities.js'

export interface TraceEntry {
  traceId: string
  userId: string
  capability: string
  path: string
  timestamp: number
  latency: number
  finalProvider?: string
  bypassed: boolean
  source: string
}

class RuntimeCallTracer {
  private traces: TraceEntry[] = []
  private attached = false
  private maxTraces = 10000

  /**
   * 附加追踪器（注入 hook）
   */
  attach(): void {
    if (this.attached) {
      console.warn('[RuntimeCallTracer] ⚠️ 已在运行')
      return
    }
    this.attached = true
    console.log('[RuntimeCallTracer] 🔍 运行时追踪器已附加')
  }

  /**
   * 记录一次调用追踪
   */
  record(entry: Omit<TraceEntry, 'traceId' | 'timestamp'>): void {
    const trace: TraceEntry = {
      ...entry,
      traceId: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    }

    this.traces.push(trace)
    if (this.traces.length > this.maxTraces) {
      this.traces.shift()
    }

    // bypass 标记日志
    if (trace.bypassed) {
      console.warn(`[RuntimeCallTracer] ❌ BYPASS DETECTED: ${trace.source} → ${trace.path}`)
    }
  }

  /**
   * 生成调用追踪图（静态分析）
   */
  generateTraceGraph(): { nodes: any[]; edges: any[]; bypassCount: number } {
    const nodes = new Map<string, any>()
    const edges: any[] = []
    let bypassCount = 0

    for (const trace of this.traces) {
      if (trace.bypassed) bypassCount++

      // 节点
      const parts = trace.path.split(' → ')
      parts.forEach((p, i) => {
        if (!nodes.has(p)) {
          nodes.set(p, { id: p, label: p, count: 1 })
        } else {
          nodes.get(p)!.count++
        }

        if (i < parts.length - 1) {
          edges.push({ from: p, to: parts[i + 1], count: 1 })
        }
      })
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
      bypassCount,
    }
  }

  /**
   * 获取所有追踪
   */
  getTraces(): TraceEntry[] {
    return [...this.traces]
  }

  /**
   * 获取 bypass 列表
   */
  getBypasses(): TraceEntry[] {
    return this.traces.filter(t => t.bypassed)
  }

  /**
   * 获取统计
   */
  getStats() {
    return {
      totalTraces: this.traces.length,
      totalBypasses: this.traces.filter(t => t.bypassed).length,
      uniqueSources: [...new Set(this.traces.map(t => t.source))],
      uniqueCapabilities: [...new Set(this.traces.map(t => t.capability))],
    }
  }
}

export const runtimeCallTracer = new RuntimeCallTracer()
