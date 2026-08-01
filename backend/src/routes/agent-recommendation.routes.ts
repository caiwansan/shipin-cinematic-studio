/**
 * routes/agent-recommendation.routes.ts — AI 员工模型智能推荐层（AI-CENTER-02C）
 *
 * 掌柜指令 2026-08-01：AI员工身份 + 业务场景 + 能力评分 + 成本策略 → 推荐模型组合。
 * 复用 AIProviderDirectory + workspaceAIWeight + AgentAIProfile（不新增 Provider 体系）。
 *
 * 公开接口：
 *   GET /api/ai/agent-recommendation?agentType=recruiter&workspace=job
 *
 * 融合逻辑（第一版，可解释不堆算法）：
 *   1. 画像 = AgentAIProfile[agentType]（status=active）
 *      无画像 → 回退 workspaceAIWeight[workspace]（job 默认），诚实标注「基于场景默认权重」
 *   2. avoidCapabilities：对应维度权重 ×0.3（显著降低，不硬排除 → 不会出现空集）
 *   3. costPreference：cost_priority → cost×1.6 / quality_priority → quality×1.6
 *   4. 归一化权重（Σ=100）→ score = Σ(capabilityScore × weight) → 0-100 可比
 *   5. primary = top1，secondary = top2；reasons = 角色化原因 + 维度得分段 + 相对领先
 *
 * 边界（冻结）：
 *   - 只建议，不自动切换模型 / 不修改 Runtime / 不修改 UserModelConfigV2
 *   - 无画像 agentType 不伪造：回退场景权重并标注来源
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { DIM_KEYS, DimKey, DIM_LABELS, scoreLabel, buildReasons, getWeight, WORKSPACE_LABELS } from './ai-recommendations.routes.js'

/** 成本偏好 → 维度权重倍率（第一版用固定倍率，简单可解释） */
const COST_MULTIPLIER: Record<string, { dim: DimKey; mult: number; label: string }> = {
  cost_priority: { dim: 'cost', mult: 1.6, label: '成本优先策略' },
  quality_priority: { dim: 'quality', mult: 1.6, label: '质量优先策略' },
  balanced: { dim: 'cost', mult: 1.0, label: '均衡策略' },
}

const AVOID_MULTIPLIER = 0.3

function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/**
 * 画像权重 → 融合权重：
 * - avoid 维度 ×0.3
 * - costPreference 维度 ×1.6
 * - 归一化到 Σ=100（保持 0-100 分数可比）
 */
function buildAgentWeight(
  preferred: Record<string, number>,
  avoid: Record<string, number>,
  costPreference: string,
): { weights: Record<DimKey, number>; costLabel: string } {
  const raw: Record<DimKey, number> = {} as Record<DimKey, number>
  let sum = 0
  for (const d of DIM_KEYS) {
    let w = Number(preferred[d]) || 0
    if (avoid[d]) w *= AVOID_MULTIPLIER
    const cp = COST_MULTIPLIER[costPreference] || COST_MULTIPLIER.balanced
    if (cp && d === cp.dim && w > 0) w *= cp.mult
    raw[d] = Math.round(w * 10) / 10
    sum += raw[d]
  }
  const weights = {} as Record<DimKey, number>
  if (sum > 0) {
    for (const d of DIM_KEYS) weights[d] = Math.round((raw[d] / sum) * 100 * 10) / 10
  }
  return { weights, costLabel: COST_MULTIPLIER[costPreference]?.label || '均衡策略' }
}

/**
 * 02C 共享引擎：按画像完整推荐（avoid×0.3 + costPreference×1.6 + 归一化）
 * 供 02C 路由 / 03A 团队协作观察层复用——保证 Bob 在团队卡片仍是 GPT/Claude
 */
export async function recommendForAgentType(agentType: string) {
  const profile = await prisma.agentAiProfile.findUnique({ where: { agentType } })
  if (!profile) return null
  const ws = profile.workspace || 'job'
  const providers = await prisma.aiProviderDirectory.findMany({ where: { status: 'active', apiEnabled: true } })

  let weights: Record<DimKey, number>
  let costLabel = '均衡策略'
  const preferred = parseJson<Record<string, number>>(profile.preferredCapabilities, {})
  const avoid = parseJson<Record<string, number>>(profile.avoidCapabilities, {})
  const fused = buildAgentWeight(preferred, avoid, profile.costPreference)
  weights = fused.weights
  costLabel = fused.costLabel

  const scored: Array<{ provider: string; name: string; score: number; reasons: string[] }> = []
  const rankMap: Record<DimKey, Map<string, number>> = {} as Record<DimKey, Map<string, number>>
  for (const d of DIM_KEYS) {
    const sorted = providers
      .filter((p) => p.capabilityScore && typeof p.capabilityScore === 'object')
      .sort((a, b) => (Number((b.capabilityScore as any)?.[d]) || 0) - (Number((a.capabilityScore as any)?.[d]) || 0))
    rankMap[d] = new Map(sorted.map((p, i) => [p.code, i + 1]))
  }
  for (const p of providers) {
    const caps = p.capabilityScore as Record<string, number> | null
    if (!caps || typeof caps !== 'object') continue
    let total = 0
    for (const d of DIM_KEYS) total += (Number(caps[d]) || 0) * (weights[d] || 0)
    const score = Math.round((total / 100) * 10) / 10
    const rankOf: Record<DimKey, number> = {} as Record<DimKey, number>
    for (const d of DIM_KEYS) rankOf[d] = rankMap[d].get(p.code) || 99
    scored.push({ provider: p.code, name: p.name, score, reasons: buildReasons(caps, weights, rankOf) })
  }
  scored.sort((a, b) => b.score - a.score)
  const [primary, secondary] = scored
  return { primary, secondary, costLabel }
}

export default async function agentRecommendationRoutes(app: FastifyInstance) {
  app.get('/api/ai/agent-recommendation', async (req, reply) => {
    const { agentType, workspace } = req.query as { agentType?: string; workspace?: string }
    if (!agentType) {
      return reply.status(400).send({ code: 1, error: 'agentType 必填（recruiter | interview | talent_analyst | career_advisor ...）' })
    }

    const [profile, providers] = await Promise.all([
      prisma.agentAiProfile.findUnique({ where: { agentType } }),
      prisma.aiProviderDirectory.findMany({ where: { status: 'active', apiEnabled: true } }),
    ])

    const ws = workspace || profile?.workspace || 'job'
    let weights: Record<DimKey, number>
    let costLabel = '均衡策略'
    let weightSource = 'agent_profile'

    if (profile && profile.status === 'active') {
      const preferred = parseJson<Record<string, number>>(profile.preferredCapabilities, {})
      const avoid = parseJson<Record<string, number>>(profile.avoidCapabilities, {})
      const fused = buildAgentWeight(preferred, avoid, profile.costPreference)
      weights = fused.weights
      costLabel = fused.costLabel
      weightSource = 'agent_profile'
    } else {
      // 无画像：回退场景权重，诚实标注（不伪造角色画像）
      weights = await getWeight(ws)
      weightSource = 'workspace_default'
    }

    const scored: Array<{ provider: string; name: string; score: number; reasons: string[] }> = []

    // 各维度全体排名（相对优势）
    const rankMap: Record<DimKey, Map<string, number>> = {} as Record<DimKey, Map<string, number>>
    for (const d of DIM_KEYS) {
      const sorted = providers
        .filter((p) => p.capabilityScore && typeof p.capabilityScore === 'object')
        .sort((a, b) => (Number((b.capabilityScore as any)?.[d]) || 0) - (Number((a.capabilityScore as any)?.[d]) || 0))
      rankMap[d] = new Map(sorted.map((p, i) => [p.code, i + 1]))
    }

    for (const p of providers) {
      const caps = p.capabilityScore as Record<string, number> | null
      if (!caps || typeof caps !== 'object') continue
      let total = 0
      for (const d of DIM_KEYS) total += (Number(caps[d]) || 0) * (weights[d] || 0)
      const score = Math.round((total / 100) * 10) / 10
      const rankOf: Record<DimKey, number> = {} as Record<DimKey, number>
      for (const d of DIM_KEYS) rankOf[d] = rankMap[d].get(p.code) || 99
      scored.push({ provider: p.code, name: p.name, score, reasons: buildReasons(caps, weights, rankOf) })
    }

    scored.sort((a, b) => b.score - a.score)
    const [primary, secondary] = scored

    // reasons：角色化原因（reasonNotes）优先，不足补维度理由
    const roleNotes = profile ? parseJson<string[]>(profile.reasonNotes, []) : []
    const reasons: string[] = []
    if (roleNotes.length >= 2) {
      reasons.push(...roleNotes.slice(0, 3))
      if (costLabel !== '均衡策略') reasons.push(`${costLabel}（${DIM_LABELS[COST_MULTIPLIER[profile?.costPreference || 'balanced']?.dim || 'cost']}权重提升）`)
    } else if (primary) {
      reasons.push(...primary.reasons.slice(0, 3))
    }

    return {
      code: 0,
      data: {
        agentType,
        roleName: profile?.roleName || agentType,
        workspace: ws,
        workspaceLabel: WORKSPACE_LABELS[ws] || ws,
        weightSource, // agent_profile | workspace_default（无画像诚实标注）
        costPreference: profile?.costPreference || 'balanced',
        costLabel,
        weightConfig: weights,
        primary: primary
          ? { provider: primary.provider, name: primary.name, score: primary.score }
          : null,
        secondary: secondary
          ? { provider: secondary.provider, name: secondary.name, score: secondary.score }
          : null,
        reasons: reasons.slice(0, 4),
      },
    }
  })
}
