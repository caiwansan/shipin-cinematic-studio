/**
 * vp-ir-quality-schema.ts — Director Layer v6.7 VP-IR 质量评分系统
 *
 * 定义 VP-IR 编译结果的反馈数据模型。
 * 所有字段从 execution telemetry + 用户行为推断。
 *
 * 设计原则：
 *   1. 纯数据 — 不包含计算逻辑
 *   2. 零 AI 依赖
 *   3. 可聚合 — 所有 score 可在 timeline 上做平均数/分位数
 */

// ============================================================
// Prompt Execution Feedback
// ============================================================

export interface PromptExecutionFeedback {
  /** 本次执行的唯一标识 */
  feedbackId: string
  /** 关联的 VP-IR 编译结果 */
  promptId: string

  /** 目标模型 */
  model: string
  /** 执行是否成功 */
  success: boolean
  /** 模型调用延迟（毫秒） */
  latencyMs: number

  /** 用户行为 */
  userAction?: 'accepted' | 'regenerated' | 'modified' | 'dismissed'

  /** 用户主观评分（1-5，0=未评分） */
  userRating?: number

  /** 系统评估的视觉质量分数（0-1） */
  visualQualityScore?: number
}

// ============================================================
// VP-IR 质量评分
// ============================================================

export interface VPIRQualityScore {
  /** IR 哈希标识 */
  irHash: string
  /** 统计窗口内的执行次数 */
  totalExecutions: number
  /** 稳定度分数（0-1，越高表示相同 IR 输出越一致） */
  stabilityScore: number
  /** 成功 rate（0-1） */
  successRate: number
  /** 平均用户评分 */
  averageUserRating?: number
  /** 用户采纳率（accepted / total） */
  acceptanceRate?: number
  /** 平均延迟 */
  avgLatencyMs: number

  /** 最近更新时间 */
  lastUpdated: number
}

// ============================================================
// 注册反馈（内存存储）
// ============================================================

const feedbackStore: Map<string, PromptExecutionFeedback> = new Map()

export function recordFeedback(feedback: PromptExecutionFeedback): void {
  feedbackStore.set(feedback.feedbackId, feedback)
}

export function getFeedback(promptId: string): PromptExecutionFeedback[] {
  return Array.from(feedbackStore.values()).filter((f) => f.promptId === promptId)
}

export function getAllFeedback(): PromptExecutionFeedback[] {
  return Array.from(feedbackStore.values())
}

export function getVPIRQuality(irHash: string): VPIRQualityScore | undefined {
  // 为简化实现，直接返回汇总
  const allFeedback = getAllFeedback()
  const relevant = allFeedback.filter((f) => f.feedbackId.startsWith(irHash))
  if (relevant.length === 0) return undefined

  const successCount = relevant.filter((f) => f.success).length
  const acceptedCount = relevant.filter((f) => f.userAction === 'accepted').length
  const ratings = relevant.map((f) => f.userRating).filter((r) => r && r > 0) as number[]
  const latencies = relevant.map((f) => f.latencyMs)

  return {
    irHash,
    totalExecutions: relevant.length,
    stabilityScore: successCount / relevant.length,
    successRate: successCount / relevant.length,
    averageUserRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
    acceptanceRate: relevant.length > 0 ? acceptedCount / relevant.length : undefined,
    avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    lastUpdated: Date.now(),
  }
}
