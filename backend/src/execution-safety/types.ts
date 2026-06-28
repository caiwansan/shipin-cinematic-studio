/**
 * execution-safety/types.ts — Safety Layer 类型定义
 *
 * Safety Layer 只回答一个问题："这个调用能不能执行？"
 * 不参与任何 provider 选择、路由、成本优化。
 */

/** 熔断状态 */
export type CircuitState = 'closed' | 'open' | 'half_open'

/** Safety Gate 输入 — adapter 调用前传入的当前 provider 状态 */
export interface SafetyState {
  /** 是否被管理员禁用 */
  enabled: boolean
  /** provider 级别状态 */
  status: string
  /** 连续失败次数 */
  failureCount: number
  /** 熔断开启时间戳 (ms) */
  circuitOpenedAt: number | null
}
