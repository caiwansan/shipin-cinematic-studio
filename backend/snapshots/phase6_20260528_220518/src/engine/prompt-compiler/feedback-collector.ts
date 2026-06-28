/**
 * feedback-collector.ts — Director Layer v6.7 Feedback Collector
 *
 * 职责：在模型执行完成后收集反馈数据，注入到 VP-IR 质量评分系统。
 *
 * 注入点：
 *   1. video-generation 完成后（成功/失败）
 *   2. 用户交互（接受/重生成/修改）
 *   3. 用户主观评分
 *
 * 设计原则：
 *   1. fire-and-forget — 不阻塞执行流程
 *   2. 非侵入 — 不改调用方签名
 *   3. 零 AI 依赖
 */

import { recordFeedback, type PromptExecutionFeedback } from './vp-ir-quality-schema.js'

// ============================================================
// Feedback Collector
// ============================================================

export class FeedbackCollector {
  private static counter = 0

  /**
   * 记录模型执行完成的反馈
   * 注入点：video-generation / image-generation 成功/失败回调
   */
  static recordExecution(params: {
    promptId: string
    model: string
    success: boolean
    latencyMs: number
    userAction?: 'accepted' | 'regenerated' | 'modified' | 'dismissed'
    userRating?: number
    visualQualityScore?: number
  }): void {
    try {
      this.counter++
      const feedback: PromptExecutionFeedback = {
        feedbackId: `${params.promptId}_${Date.now()}_${this.counter}`,
        promptId: params.promptId,
        model: params.model,
        success: params.success,
        latencyMs: params.latencyMs,
        userAction: params.userAction,
        userRating: params.userRating,
        visualQualityScore: params.visualQualityScore,
      }
      recordFeedback(feedback)
    } catch (err) {
      console.warn('[FeedbackCollector] recordExecution 失败:', err)
    }
  }

  /**
   * 记录用户接受/拒绝反馈
   * 注入点：前端用户交互按钮
   */
  static recordUserAction(params: {
    promptId: string
    action: 'accepted' | 'regenerated' | 'modified' | 'dismissed'
  }): void {
    try {
      this.counter++
      const feedback: PromptExecutionFeedback = {
        feedbackId: `${params.promptId}_user_${Date.now()}_${this.counter}`,
        promptId: params.promptId,
        model: '',
        success: true,
        latencyMs: 0,
        userAction: params.action,
      }
      recordFeedback(feedback)
    } catch (err) {
      console.warn('[FeedbackCollector] recordUserAction 失败:', err)
    }
  }
}
