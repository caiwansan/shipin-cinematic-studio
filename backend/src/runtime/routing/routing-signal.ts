/**
 * routing-signal.ts — Phase 2.0 统一信号模型
 *
 * ═══════════════════════════════════════════════════════════════
 * 这是整个可观测路由系统的数据契约。
 *
 * 所有路由决策的"现实反馈"必须标准化为 RoutingSignal，
 * 再由 MetricsStore 消费。
 *
 * 约束（不可违反）：
 *   1. 信号层不参与决策 —— 只采集，不评分
 *   2. Phase 2.1 之前，signal 不得进入 model-selection-engine
 *   3. 字段一旦稳定不可删除（可弃用，加 deprecated 标记）
 * ═══════════════════════════════════════════════════════════════
 */

// ─── 统一信号模型 ─────────────────────────────────────────────

export interface RoutingSignal {
  /** 模型名，如 doubao-seedance-2-0 */
  model: string
  /** provider 名，如 volcengine */
  provider: string
  /** 能力类型 */
  capability: 'llm' | 'image' | 'video' | 'tts'
  /** 请求耗时 ms（必需） */
  latencyMs: number
  /** 消耗 token 数（llm 类填；image/video 不适用时 0） */
  tokenCount: number
  /** 估计成本 USD */
  costUsd: number
  /** 成功/失败 */
  success: boolean
  /** 错误消息（失败时），长度限制 200 chars */
  errorMsg?: string
  /** 路由来源 */
  routeSource: 'db' | 'legacy' | 'shim'
  /** 决策解释 */
  selectionReason?: string
  /** 时间戳 Unix ms */
  timestamp: number
  /** traceId（可选，用于关联链路） */
  traceId?: string
  /** 用户 id（可选，不用于决策） */
  userId?: string
}

// ─── 聚合统计（单 provider 窗口） ────────────────────────────

export interface ProviderMetricsWindow {
  provider: string
  capabilities: string[]
  /** 窗口内总请求数 */
  totalRequests: number
  /** 窗口内成功数 */
  successCount: number
  /** 窗口内失败数 */
  failCount: number
  /** 错误率 0-1 */
  errorRate: number
  /** 平均延迟 ms */
  avgLatencyMs: number
  /** p50 延迟 ms */
  p50LatencyMs: number
  /** p95 延迟 ms */
  p95LatencyMs: number
  /** 平均成本 USD */
  avgCostUsd: number
  /** 总成本 USD */
  totalCostUsd: number
  /** 窗口起始时间 Unix ms */
  windowStartMs: number
  /** 窗口结束时间 Unix ms */
  windowEndMs: number
}

export default RoutingSignal
