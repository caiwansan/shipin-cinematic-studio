// ============================================================
// Usage Recorder — KMKI-RUNTIME-008
// 自动记录每次 LLM 调用的 Token 消耗、延迟、成本
// 独立表 LLMUsageRecord，不污染 UserModelConfig
// ============================================================

import { llmUsageRecordRepository } from '../../repositories/llm-usage-record.repository.js'

export interface UsageRecord {
  userId?: string
  projectId?: string
  agent: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
  status: 'success' | 'error'
  error?: string
  traceId?: string
  workflowId?: string
  executionId?: string
  promptKey?: string
  promptVersion?: string
  cost?: number
}

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'deepseek/deepseek-v4-flash': { input: 0.00027, output: 0.0011 },
  'deepseek/deepseek-v4-pro': { input: 0.00055, output: 0.0022 },
  'volcengine/doubao-seed-2-0-mini-260428': { input: 0.0003, output: 0.0006 },
  'volcengine/doubao-seed-2-0-plus-260428': { input: 0.0008, output: 0.0012 },
  'openai/gpt-4o': { input: 0.005, output: 0.015 },
}

/**
 * 计算单次调用成本（美元）
 */
function estimateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  const key = `${provider}/${model}`
  const rate = COST_PER_1K_TOKENS[key]
  if (!rate) return 0
  return (promptTokens / 1000) * rate.input + (completionTokens / 1000) * rate.output
}

class UsageRecorder {
  /**
   * 记录一次 LLM 调用
   */
  async record(rec: UsageRecord): Promise<void> {
    const cost = rec.cost ?? estimateCost(rec.provider, rec.model, rec.promptTokens, rec.completionTokens)

    try {
      // UUID 列需要有效的 UUID 或 null，不能是空字符串
      const safeUserId = rec.userId || '00000000-0000-0000-0000-000000000000'
      await llmUsageRecordRepository.create({
        data: {
          userId: safeUserId,
          projectId: rec.projectId || null,
          agent: rec.agent,
          provider: rec.provider,
          model: rec.model,
          promptTokens: rec.promptTokens,
          completionTokens: rec.completionTokens,
          totalTokens: rec.totalTokens,
          latencyMs: rec.latencyMs,
          status: rec.status,
          error: rec.error || null,
          traceId: rec.traceId || null,
          workflowId: rec.workflowId || null,
          executionId: rec.executionId || null,
          promptKey: rec.promptKey || null,
          promptVersion: rec.promptVersion || null,
          cost: cost,
        },
      })
    } catch (err) {
      // Usage recording failure must never break the main flow
      console.error('[UsageRecorder] Failed to record usage:', (err as Error).message)
    }
  }

  /**
   * 批量记录
   */
  async recordMany(records: UsageRecord[]): Promise<void> {
    for (const rec of records) {
      await this.record(rec)
    }
  }

  /**
   * 查询项目的 Token 消耗汇总
   */
  async getProjectUsage(projectId: string): Promise<{
    totalTokens: number
    totalCost: number
    callCount: number
    byAgent: Record<string, { tokens: number; calls: number }>
  }> {
    const records = await llmUsageRecordRepository.findMany({
      where: { projectId, status: 'success' },
    })

    const summary = {
      totalTokens: 0,
      totalCost: 0,
      callCount: records.length,
      byAgent: {} as Record<string, { tokens: number; calls: number }>,
    }

    for (const rec of records) {
      summary.totalTokens += rec.totalTokens
      summary.totalCost += Number(rec.cost || 0)
      if (!summary.byAgent[rec.agent]) {
        summary.byAgent[rec.agent] = { tokens: 0, calls: 0 }
      }
      summary.byAgent[rec.agent].tokens += rec.totalTokens
      summary.byAgent[rec.agent].calls++
    }

    return summary
  }
}

export const usageRecorder = new UsageRecorder()
