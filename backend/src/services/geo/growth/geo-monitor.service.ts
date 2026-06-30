// ============================================================
// GEO Growth Engine — Continuous GEO Monitor Service (v3)
// Score snapshots, drift detection, auto-generated tasks
// ============================================================

import { prisma } from '../../../utils/index.js'
import { calculateScore } from '../recommendation/recommendation-score.service.js'

export interface DriftResult {
  drifted: boolean
  changes: string[]
  currentScore: number
  previousScore?: number
}

/**
 * Create a GeoScoreSnapshot for timeline tracking
 */
export async function createScoreSnapshot(projectId: string): Promise<void> {
  const score = await calculateScore(projectId)
  const scores = {
    overall: score.overall,
    visibility: score.breakdown.visibility.score,
    authority: score.breakdown.authority.score,
    content: score.breakdown.content.score,
    website: score.breakdown.website.score,
    knowledge: score.breakdown.knowledge.score,
  }
  try {
    await prisma.gEOScoreSnapshot.create({
      data: {
        projectId,
        snapshot: score as any,
        scores: scores as any,
      },
    })
  } catch (err: any) {
    // Silently fail — snapshots are non-critical
    console.warn(`[geo-monitor] Snapshot failed for ${projectId}: ${err.message}`)
  }
}

/**
 * Detect score drift by comparing current score to the last snapshot
 */
export async function detectDrift(projectId: string): Promise<DriftResult> {
  const currentScore = await calculateScore(projectId)

  const lastSnapshot = await prisma.gEOScoreSnapshot.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })

  if (!lastSnapshot) {
    // No prior snapshot, create one and return no drift
    await createScoreSnapshot(projectId)
    return { drifted: false, changes: [], currentScore: currentScore.overall }
  }

  const previousScores = (lastSnapshot.scores as any) || {}
  const previousOverall = previousScores.overall ?? currentScore.overall
  const diff = currentScore.overall - previousOverall

  const changes: string[] = []
  const breakdownDims: Array<{ key: string; label: string; before: number; after: number }> = [
    { key: 'visibility', label: '可见性', before: previousScores.visibility ?? 0, after: currentScore.breakdown.visibility.score },
    { key: 'authority', label: '权威性', before: previousScores.authority ?? 0, after: currentScore.breakdown.authority.score },
    { key: 'content', label: '内容', before: previousScores.content ?? 0, after: currentScore.breakdown.content.score },
    { key: 'website', label: '官网', before: previousScores.website ?? 0, after: currentScore.breakdown.website.score },
    { key: 'knowledge', label: '知识', before: previousScores.knowledge ?? 0, after: currentScore.breakdown.knowledge.score },
  ]

  for (const dim of breakdownDims) {
    const dimDiff = dim.after - dim.before
    if (Math.abs(dimDiff) >= 5) {
      changes.push(`${dim.label}: ${dimDiff > 0 ? '+' : ''}${dimDiff} 分`)
    }
  }

  const drifted = Math.abs(diff) >= 10 || changes.length >= 2

  // Save new snapshot
  await createScoreSnapshot(projectId)

  return {
    drifted,
    changes: drifted ? [`整体评分变化: ${diff > 0 ? '+' : ''}${diff} 分`, ...changes] : [],
    currentScore: currentScore.overall,
    previousScore: previousOverall,
  }
}

/**
 * Auto-generate optimization tasks based on current score gaps
 */
export async function autoGenerateTasks(projectId: string): Promise<Array<{ type: string; reason: string }>> {
  const score = await calculateScore(projectId)
  const tasks: Array<{ type: string; reason: string }> = []

  // Knowledge gap
  if (score.breakdown.knowledge.score < 50) {
    tasks.push({
      type: 'generate-knowledge',
      reason: `知识维度评分偏低 (${score.breakdown.knowledge.score}/100)，建议生成知识文章提升内容覆盖`,
    })
    tasks.push({
      type: 'generate-faq',
      reason: '知识维度不足，生成 FAQ 可快速提升',
    })
  }

  // Content gap
  if (score.breakdown.content.score < 60) {
    tasks.push({
      type: 'generate-about',
      reason: `内容维度评分偏低 (${score.breakdown.content.score}/100)，缺少品牌介绍`,
    })
    tasks.push({
      type: 'generate-brand-story',
      reason: '内容维度不足，品牌故事可显著提升',
    })
  }

  // Schema gap
  if (score.breakdown.knowledge.score < 70) {
    tasks.push({
      type: 'generate-schema-org',
      reason: '缺少 Organization Schema，结构化数据标记可提升 AI 可读性',
    })
    tasks.push({
      type: 'generate-schema-faq',
      reason: '缺少 FAQ Schema，有助于提升搜索引擎和 AI 的理解',
    })
  }

  // Product description
  if (score.breakdown.content.score < 80) {
    tasks.push({
      type: 'generate-product',
      reason: `产品说明可补充内容维度 (当前 ${score.breakdown.content.score}/100)`,
    })
  }

  // Breadcrumb
  if (score.breakdown.website.score > 30 && score.breakdown.knowledge.score < 80) {
    tasks.push({
      type: 'generate-schema-breadcrumb',
      reason: 'Breadcrumb Schema 可进一步优化网站结构表现',
    })
  }

  return tasks
}
