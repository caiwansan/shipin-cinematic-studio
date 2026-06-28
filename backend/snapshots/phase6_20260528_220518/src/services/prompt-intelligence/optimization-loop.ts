// @ts-nocheck
// ============================================================
// 📦 Optimization Loop — 闭环核心🔥🔥
//
// 职责：编排完整的优化循环
// 低质量输出 → 评估 → 优化 prompt → 重新入队 → 新结果
// ============================================================

import { promptMemory, PromptRecord } from './prompt-memory.js'
import { promptEvaluator, EvaluationResult } from './prompt-evaluator.js'
import { promptOptimizer, OptimizeInput, OptimizeResult } from './prompt-optimizer.js'
import { aiRouter } from '../ai-router.service.js'

export interface LoopConfig {
  maxRetries: number       // 最大重试次数
  qualityThreshold: number // 质量阈值（低于此值触发优化）
  autoRetry: boolean       // 是否自动重试
}

export interface LoopResult {
  finalPrompt: string
  optimized: boolean
  retries: number
  evaluation: EvaluationResult | null
  improvements: string[]
  recorded: boolean
}

const DEFAULT_CONFIG: LoopConfig = {
  maxRetries: 2,
  qualityThreshold: 6.0,
  autoRetry: true,
}

export const optimizationLoop = {
  /**
   * 单次执行：优化 → 评估 → 记录
   */
  async runOnce(
    input: OptimizeInput,
    config: Partial<LoopConfig> = {},
  ): Promise<{ optimizeResult: OptimizeResult; evaluation: EvaluationResult }> {
    // 1. 优化 prompt
    const optimizeResult = await promptOptimizer.optimize(input)

    // 2. 评估（基于 prompt 本身评分）
    const evaluation = await promptEvaluator.evaluate({
      prompt: optimizeResult.optimizedPrompt,
      optimizedPrompt: optimizeResult.optimizedPrompt,
      taskType: input.taskType,
      mode: input.mode,
    })

    return { optimizeResult, evaluation }
  },

  /**
   * 完整闭环执行（含 retry）
   */
  async run(
    input: OptimizeInput,
    config: Partial<LoopConfig> = {},
  ): Promise<LoopResult> {
    const cfg = { ...DEFAULT_CONFIG, ...config }
    let currentInput = { ...input }
    let retries = 0
    let evaluation: EvaluationResult | null = null
    let optimizeResult: OptimizeResult

    do {
      const cycle = await this.runOnce(currentInput, cfg)
      optimizeResult = cycle.optimizeResult
      evaluation = cycle.evaluation

      // 如果质量达标，结束循环
      if (evaluation.totalScore >= cfg.qualityThreshold) {
        break
      }

      // 未达标 → 重新优化
      retries++
      if (retries <= cfg.maxRetries && cfg.autoRetry) {
        const reOptimized = await promptOptimizer.reOptimize(currentInput, evaluation)
        currentInput.rawPrompt = reOptimized.optimizedPrompt
        optimizeResult = reOptimized
      }
    } while (retries < cfg.maxRetries && cfg.autoRetry)

    return {
      finalPrompt: optimizeResult.optimizedPrompt,
      optimized: optimizeResult.usedLLM || optimizeResult.usedHistory,
      retries,
      evaluation,
      improvements: optimizeResult.improvements,
      recorded: false, // 执行后由外部调用 recordExecution
    }
  },

  /**
   * 记录执行结果到 Prompt Memory
   */
  async recordExecution(
    record: Omit<PromptRecord, 'id'>,
  ): Promise<void> {
    await promptMemory.record({
      ...record,
      qualityScore: record.qualityScore ?? undefined,
    })
  },

  /**
   * 用户反馈更新
   */
  async recordFeedback(
    promptMemoryId: string,
    feedback: 'approve' | 'reject' | 'neutral',
  ): Promise<void> {
    const { prisma } = await import('../../utils/index.js')
    await prisma.promptMemory.update({
      where: { id: promptMemoryId },
      data: { feedback },
    })
  },
}
