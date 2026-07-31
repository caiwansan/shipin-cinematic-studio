/**
 * services/director/director-decision-generator.service.ts
 *
 * DirectorDecisionGenerator — AI 导演决策生成器
 *
 * 职责：
 *   基于 AssetQualityReport + ProductionContext
 *   生成 DirectorDecisionContract
 *
 * 核心约束：
 *   ❌ 不调用 AI Provider
 *   ❌ 不修改 Asset
 *   ❌ 所有 output.requiresConfirmation = true（类型锁死）
 *   ❌ 不自动提交 Task
 *
 * 数据流：
 *   observeAsset(assetId) → AssetQualityReport
 *     ↓
 *   generateDecision(report, context) → DirectorDecisionContract
 *     ↓
 *   POST /api/director/assets/:assetId/decision → 返回给用户
 *     ↓
 *   用户确认 → POST /api/director/decisions/:id/confirm
 */

import { v4 as uuidv4 } from 'uuid'
import type { DirectorDecisionContract, DecisionType } from '../../types/director-decision-contract.js'
import type { AssetQualityReport } from './asset-quality-observer.service.js'
import { prisma } from '../../utils/index.js'

// ── 决策阈值 ──

const DECISION_THRESHOLDS = {
  /** 质量足够 → keep */
  KEEP_MIN_SCORE: 75,
  /** 低质量 → 建议修改/重生成 */
  REGENERATE_MAX_SCORE: 40,
}

// ── 主入口 ──

/**
 * 基于质量报告生成导演决策
 *
 * @param report 质量报告
 * @param userId 当前用户 ID
 * @returns DirectorDecisionContract
 */
export async function generateDecision(
  report: AssetQualityReport,
  userId: string,
): Promise<DirectorDecisionContract> {
  const { score, issues, dimensions, source } = report

  // 1. 判断决策类型
  const { decisionType, confidence } = classifyDecision(score, issues, source)

  // 2. 生成理由
  const reason = buildReason(decisionType, score, issues, dimensions)

  // 3. 生成建议动作
  const suggestedAction = buildSuggestedAction(decisionType, source.projectId, source.specType)

  // 4. 构建契约
  const contract: DirectorDecisionContract = {
    id: uuidv4(),
    ownerId: userId,
    assetId: report.assetId,
    qualityReportId: `${report.assetId}_${report.analyzedAt.toISOString().split('T')[0]}`,
    decisionType,
    reason,
    confidence,
    suggestedAction,
    requiresConfirmation: true as const, // typed lock
    status: 'pending',
    createdAt: new Date(),
  }

  // 5. 持久化到 TaskLog.metadata（不创建新表）
  try {
    await prisma.taskLog.create({
      data: {
        taskId: report.assetId,
        level: 'info',
        message: `导演决策: ${decisionType} (confidence=${confidence})`,
        metadata: {
          directorDecision: {
            id: contract.id,
            ownerId: contract.ownerId,
            assetId: contract.assetId,
            decisionType: contract.decisionType,
            reason: contract.reason,
            confidence: contract.confidence,
            suggestedAction: contract.suggestedAction,
            requiresConfirmation: contract.requiresConfirmation,
            status: contract.status,
            createdAt: contract.createdAt.toISOString(),
          },
        },
      },
    })
  } catch {
    // TaskLog 写入失败不阻塞
  }

  return contract
}

// ── 决策分类逻辑 ──

function classifyDecision(
  score: number,
  issues: string[],
  source: { hasOutput: boolean; status: string },
): { decisionType: DecisionType; confidence: number } {
  // 没有输出 → 建议重生成
  if (!source.hasOutput || source.status !== 'completed') {
    return {
      decisionType: 'regenerate',
      confidence: Math.min(90, 50 + issues.length * 10),
    }
  }

  // 高分 → keep
  if (score >= DECISION_THRESHOLDS.KEEP_MIN_SCORE) {
    return {
      decisionType: 'keep',
      confidence: Math.min(95, 60 + Math.round((score - 75) / 25 * 35)),
    }
  }

  // 低分 → 视情况
  if (score <= DECISION_THRESHOLDS.REGENERATE_MAX_SCORE) {
    return {
      decisionType: 'regenerate',
      confidence: Math.min(85, 50 + issues.length * 8),
    }
  }

  // 中间分 → 修改 prompt
  const hasCharacterIssue = issues.some(i =>
    i.includes('角色') || i.includes('特征')
  )
  const hasSceneIssue = issues.some(i =>
    i.includes('场景') || i.includes('要素')
  )

  if (hasCharacterIssue || hasSceneIssue) {
    return {
      decisionType: 'modify_prompt',
      confidence: Math.min(85, 55 + issues.length * 8),
    }
  }

  // fallback → 修改 prompt
  return {
    decisionType: 'modify_prompt',
    confidence: 50 + issues.length * 5,
  }
}

// ── 理由生成 ──

function buildReason(
  decisionType: DecisionType,
  score: number,
  issues: string[],
  _dimensions: Record<string, any>,
): string {
  switch (decisionType) {
    case 'keep':
      return `综合评分 ${score}/100，未发现明显质量问题，无需调整`
    case 'regenerate':
      if (issues.length === 0) {
        return `综合评分仅 ${score}/100，资产质量不达标，建议重新生成`
      }
      return `综合评分 ${score}/100，存在 ${issues.length} 个问题：${issues.join('；')}`
    case 'modify_prompt':
      return `综合评分 ${score}/100，prompt 中缺少部分关键视觉要素（构图/光线/角色特征等），建议补充描述后重试`
    case 'replace_asset':
      return `综合评分 ${score}/100，当前资产不适配场景需求，建议替换`
    default:
      return `综合评分 ${score}/100`
  }
}

// ── 建议动作生成 ──

function buildSuggestedAction(
  decisionType: DecisionType,
  projectId: string,
  specType: string | null,
): { description: string; affectedAssets: string[]; estimatedCost?: string } {
  switch (decisionType) {
    case 'keep':
      return {
        description: '无需操作，当前资产质量达标',
        affectedAssets: [projectId],
      }
    case 'regenerate':
      return {
        description: '重新生成资产',
        affectedAssets: [projectId],
        estimatedCost: specType === 'character' ? '1 次图片生成' : '1 次场景生成',
      }
    case 'modify_prompt':
      return {
        description: `${specType === 'character' ? '补充角色描述' : '补充场景描述'}后重新生成`,
        affectedAssets: [projectId],
        estimatedCost: '1 次 prompt 修改 + 1 次图片生成',
      }
    case 'replace_asset':
      return {
        description: '替换为其他场景/角色资产',
        affectedAssets: [projectId],
        estimatedCost: '1 次资产替换',
      }
    default:
      return {
        description: '请人工审核',
        affectedAssets: [projectId],
      }
  }
}
