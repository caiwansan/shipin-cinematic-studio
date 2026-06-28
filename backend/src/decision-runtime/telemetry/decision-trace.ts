/**
 * decision-trace.ts — Decision Runtime Trace Model
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-0.5: Decision Runtime Observatory Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * Trace 是 Decision Runtime 的核心观测单元。
 * 一次 execute() = 一条 Trace。
 * Trace 记录了从用户输入到最终报告的完整执行路径。
 *
 * 宪法：
 *   1. 每条 Trace 有唯一的 traceId
 *   2. Trace 不可变——写入后不允许修改
 *   3. Trace 包含完整的节点执行链和事件日志
 *   4. Trace 可用于回放和审计
 *
 * @phase decision-runtime
 */

// ============================================================
// 1. Trace Node 记录
// ============================================================

export interface TraceNodeExecution {
  /** 节点实例 ID */
  nodeId: string

  /** 节点类型（string 而非 enum，因 trace 用于存储/回放） */
  nodeType: string

  /** 开始时间 */
  startedAt: string // ISO 8601

  /** 结束时间 */
  finishedAt?: string

  /** 执行耗时（毫秒） */
  durationMs?: number

  /** 执行结果 */
  success: boolean

  /** 错误信息 */
  error?: string

  /** 输入摘要（前 200 字符，避免存大量原始数据） */
  inputSummary?: string

  /** 输出摘要 */
  outputSummary?: string
}

// ============================================================
// 2. Trace Event 记录
// ============================================================

export interface TraceEvent {
  eventId: string
  eventType: string
  timestamp: string // ISO 8601
  agentName: string
  payload: Record<string, unknown>
  durationMs?: number
}

// ============================================================
// 3. Decision Trace
// ============================================================

export interface DecisionTrace {
  /** Trace 唯一标识 */
  traceId: string

  /** Runtime 运行实例 ID */
  runtimeId: string

  /** 原始用户输入 */
  rawInput: string

  /** 开始时间 */
  startedAt: string

  /** 结束时间 */
  finishedAt?: string

  /** 总耗时（毫秒） */
  durationMs?: number

  /** 节点执行记录（按执行顺序） */
  nodes: TraceNodeExecution[]

  /** 事件记录（按时间顺序） */
  events: TraceEvent[]

  /** 最终状态 */
  status: 'running' | 'completed' | 'failed'

  /** 最终错误（如有） */
  error?: string
}

// ============================================================
// 4. Trace 工厂
// ============================================================

export function createTrace(rawInput: string): DecisionTrace {
  const now = new Date().toISOString()
  const runtimeId = `dr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  return {
    traceId: `trace_${runtimeId}`,
    runtimeId,
    rawInput,
    startedAt: now,
    nodes: [],
    events: [],
    status: 'running',
  }
}
