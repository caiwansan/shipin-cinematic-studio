/**
 * services/p18/evaluation-collector.ts
 *
 * ═══════════════════════════════════════════════════════════════
 * P1.8 Evaluation Collector — 自动指标采集
 *
 * 作用：
 *   当双轨渲染完成后，自动采集 V3 metrics 并写入 paired sample
 *   供 Switch Decision 模型使用
 *
 * 采集时机：
 *   V2 完成 → V3 完成 → 自动触发 collect()
 *
 * 输出：
 *   p18_pairs 表指标字段更新
 * ═══════════════════════════════════════════════════════════════
 */

import { prisma } from '../../utils/index.js'

export interface P18EvalCollection {
  pairId: string
  v3Metrics: {
    fillRate: Record<string, number>
    qualityRate: Record<string, number>
    semanticYield: number
  }
  stabilityMetrics: {
    fallbackRate: number
    missingFieldRate: number
    promptFailureRate: number
  }
  perceptualScores?: {
    emotionStrength: number
    shotDiversity: number
    characterConsistency: number
    sceneCoherence: number
    cinematicQuality: number
  }
}

/**
 * 采集一对双轨渲染的评估数据，更新 p18_pairs 记录。
 */
export async function collectEvalData(collection: P18EvalCollection) {
  const { pairId, v3Metrics, stabilityMetrics, perceptualScores } = collection

  try {
    await prisma.p18Pair.update({
      where: { pairId },
      data: {
        status: 'completed',
        v3FillRate: v3Metrics.fillRate,
        v3QualityRate: v3Metrics.qualityRate,
        v3SemanticYield: v3Metrics.semanticYield,
        v3FallbackRate: stabilityMetrics.fallbackRate,
        v3MissingFieldRate: stabilityMetrics.missingFieldRate,
        v3PromptFailureRate: stabilityMetrics.promptFailureRate,
        v3PerceptualScores: perceptualScores || null,
        completedAt: new Date(),
      },
    })
    return true
  } catch (err) {
    console.warn(`[p18] ⚠️ 评估数据采集失败 (${pairId}): ${(err as Error).message}`)
    return false
  }
}

/**
 * 标记双轨渲染任务为失败状态。
 */
export async function markPairFailed(pairId: string, error: string) {
  try {
    await prisma.p18Pair.update({
      where: { pairId },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
      },
    })
    return true
  } catch (err) {
    console.warn(`[p18] ⚠️ 标记失败状态失败 (${pairId}): ${(err as Error).message}`)
    return false
  }
}

/**
 * 查询已完成的配对样本列表。
 */
export async function getCompletedPairs(options: {
  limit?: number
  offset?: number
  minCount?: number
} = {}) {
  const { limit = 100, offset = 0 } = options

  return prisma.p18Pair.findMany({
    where: {
      status: 'completed',
      v3FillRate: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  })
}

/**
 * 统计当前配对样本数量。
 */
export async function countPairs(): Promise<{ total: number; completed: number; failed: number }> {
  const [total, completed, failed] = await Promise.all([
    prisma.p18Pair.count(),
    prisma.p18Pair.count({ where: { status: 'completed' } }),
    prisma.p18Pair.count({ where: { status: 'failed' } }),
  ])
  return { total, completed, failed }
}
