/**
 * P7 — ExecutionPattern（执行模式）
 *
 * 记录每次调度的决策和结果，供自优化引擎学习。
 *
 * ═══ 宪法 ═══
 * 必须记录每次调度的完整决策链路。
 * 数据是自优化的基础，禁止无痕迹的执行。
 */

import { Capability } from '../../core/runtime/capabilities.js'

export interface ExecutionPattern {
  /** 执行 ID */
  executionId: string
  /** Capability */
  capability: Capability
  /** 选择的区域 */
  selectedRegion: string
  /** 选择的节点 */
  selectedNode: string
  /** 决策分数 */
  decisionScore: number
  /** 实际延迟（ms） */
  actualLatency: number
  /** 实际成本 */
  actualCost: number
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 执行时间 */
  timestamp: number
}

export interface RoutingFeedback {
  pattern: ExecutionPattern
  /** 用户打分（0-10）*/
  userRating?: number
  /** 是否应避免此路由 */
  shouldAvoid: boolean
}
