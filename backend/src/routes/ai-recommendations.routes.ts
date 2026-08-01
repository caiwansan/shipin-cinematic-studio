/**
 * routes/ai-recommendations.routes.ts — Workspace AI 推荐引擎（AI-CENTER-02B）
 *
 * 掌柜指令 2026-08-01：规则 + 评分权重推荐引擎（第一版不做复杂算法）
 * recommendScore = Σ(capabilityScore × workspaceWeight%)，可解释、可运营。
 *
 * 公开接口：
 *   GET /api/ai/recommendations?workspace=job|shortdrama|novel|coding
 *
 * 后台（requireAdmin）：
 *   GET  /api/admin/ai-recommendation-rules       权重规则列表
 *   PUT  /api/admin/ai-recommendation-rules/:workspace  更新权重
 *
 * 数据源：
 *   - workspace_ai_weight 表（enabled=true；表空时回退内置默认权重）
 *   - ai_provider_directory.capabilityScore（六维 0-100）
 *
 * 边界（冻结）：
 *   - 不修改 Runtime / 不修改 UserModelConfigV2 / 不影响现有模型调用
 *   - 推荐只是建议，不自动切换模型
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export const WORKSPACE_LABELS: Record<string, string> = {
  job: '求职招聘',
  shortdrama: 'AI短剧',
  novel: '小说',
  coding: '代码开发',
}

const DIM_KEYS = ['cost', 'speed', 'quality', 'chinese', 'coding', 'reasoning'] as const
type DimKey = (typeof DIM_KEYS)[number]

const DIM_LABELS: Record<DimKey, string> = {
  cost: '成本优势',
  speed: '响应速度',
  quality: '生成质量',
  chinese: '中文能力',
  coding: '代码能力',
  reasoning: '推理能力',
}

/** 表数据缺失时的内置默认权重（与 seed 一致，保证引擎永不空转） */
const DEFAULT_WEIGHTS: Record<string, Record<DimKey, number>> = {
  job: { chinese: 35, reasoning: 30, quality: 20, cost: 15, speed: 0, coding: 0 },
  shortdrama: { quality: 35, chinese: 25, reasoning: 20, cost: 20, speed: 0, coding: 0 },
  novel: { chinese: 35, quality: 30, cost: 20, reasoning: 15, speed: 0, coding: 0 },
  coding: { coding: 40, reasoning: 30, speed: 15, cost: 15, chinese: 0, quality: 0 },
}

function scoreLabel(v: number): string {
  if (v >= 90) return '优秀'
  if (v >= 85) return '强'
  if (v >= 80) return '良好'
  if (v >= 70) return '尚可'
  return '一般'
}

/**
 * 生成可解释 reasons：
 * 1. 权重最高的非零维度（top 3）按得分段给出「中文能力优秀 / 推理能力强」等
 * 2. 若某维度得分居全体前 3 且权重非零，追加「XX领先」强调相对优势
 */
function buildReasons(
  caps: Record<string, number>,
  weight: Record<DimKey, number>,
  providerRank: Record<DimKey, number>, // 该 provider 各维度在全体中的排名（1=最高）
): string[] {
  const reasons: string[] = []
  const weightedDims = (DIM_KEYS as DimKey[])
    .filter((d) => (weight[d] || 0) > 0)
    .sort((a, b) => weight[b] - weight[a])

  for (const d of weightedDims.slice(0, 3)) {
    const v = caps[d] || 0
    reasons.push(`${DIM_LABELS[d]}${scoreLabel(v)}`)
  }
  for (const d of weightedDims.slice(0, 3)) {
    if (providerRank[d] <= 3 && reasons.length < 4) {
      reasons.push(`${DIM_LABELS[d]}领先`)
      break
    }
  }
  return reasons.slice(0, 4)
}

async function getWeight(workspace: string): Promise<Record<DimKey, number>> {
  const row = await prisma.workspaceAiWeight.findUnique({ where: { workspace } })
  if (row?.enabled && row.weightConfig && typeof row.weightConfig === 'object') {
    const cfg = row.weightConfig as Record<string, number>
    const out: Record<string, number> = {}
    for (const k of DIM_KEYS) out[k] = Number(cfg[k]) || 0
    return out as Record<DimKey, number>
  }
  return DEFAULT_WEIGHTS[workspace] || DEFAULT_WEIGHTS.job
}

export default async function aiRecommendationsRoutes(app: FastifyInstance) {
  // ── 公开：Workspace 推荐 ──
  app.get('/api/ai/recommendations', async (req, reply) => {
    const { workspace } = req.query as { workspace?: string }
    if (!workspace || !WORKSPACE_LABELS[workspace]) {
      return reply.status(400).send({
        code: 1,
        error: `workspace 必填，支持: ${Object.keys(WORKSPACE_LABELS).join(' | ')}`,
      })
    }

    const [weight, providers] = await Promise.all([
      getWeight(workspace),
      prisma.aiProviderDirectory.findMany({ where: { status: 'active', apiEnabled: true } }),
    ])

    const scored: Array<{
      provider: string
      name: string
      score: number
      reasons: string[]
    }> = []

    // 各维度全体排名（用于相对优势）
    const rankMap: Record<DimKey, Map<string, number>> = {} as Record<DimKey, Map<string, number>>
    for (const d of DIM_KEYS) {
      const sorted = providers
        .filter((p) => p.capabilityScore && typeof p.capabilityScore === 'object')
        .sort((a, b) => (Number((b.capabilityScore as any)?.[d]) || 0) - (Number((a.capabilityScore as any)?.[d]) || 0))
      rankMap[d] = new Map(sorted.map((p, i) => [p.code, i + 1]))
    }

    for (const p of providers) {
      const caps = p.capabilityScore as Record<string, number> | null
      if (!caps || typeof caps !== 'object') continue // 无评分不参与推荐
      let total = 0
      for (const d of DIM_KEYS) {
        total += (Number(caps[d]) || 0) * (weight[d] || 0)
      }
      const score = Math.round((total / 100) * 10) / 10
      const rankOf: Record<DimKey, number> = {} as Record<DimKey, number>
      for (const d of DIM_KEYS) rankOf[d] = rankMap[d].get(p.code) || 99
      scored.push({ provider: p.code, name: p.name, score, reasons: buildReasons(caps, weight, rankOf) })
    }

    scored.sort((a, b) => b.score - a.score)
    return {
      code: 0,
      data: {
        workspace,
        workspaceLabel: WORKSPACE_LABELS[workspace],
        weightConfig: weight,
        recommendations: scored.slice(0, 5),
      },
    }
  })

  // ── 后台：权重规则列表 ──
  app.get('/api/admin/ai-recommendation-rules', { preHandler: [requireAdmin] }, async () => {
    const rows = await prisma.workspaceAiWeight.findMany({ orderBy: { workspace: 'asc' } })
    const rules = Object.keys(WORKSPACE_LABELS).map((ws) => {
      const row = rows.find((r) => r.workspace === ws)
      return {
        workspace: ws,
        workspaceLabel: WORKSPACE_LABELS[ws],
        weightConfig: row?.weightConfig || DEFAULT_WEIGHTS[ws],
        enabled: row?.enabled ?? true,
        source: row ? 'db' : 'default',
      }
    })
    return { code: 0, data: rules }
  })

  // ── 后台：更新权重 ──
  app.put('/api/admin/ai-recommendation-rules/:workspace', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { workspace } = req.params as { workspace: string }
    if (!WORKSPACE_LABELS[workspace]) {
      return reply.status(400).send({ code: 1, error: `workspace 不支持: ${workspace}` })
    }
    const body = req.body as { weightConfig?: Record<string, number>; enabled?: boolean }
    if (!body?.weightConfig || typeof body.weightConfig !== 'object') {
      return reply.status(400).send({ code: 1, error: 'weightConfig 必填' })
    }
    // 六维白名单清洗 + 0-100 钳制 + 非负
    const clean: Record<string, number> = {}
    for (const k of DIM_KEYS) {
      const v = Number(body.weightConfig[k])
      clean[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0
    }
    const row = await prisma.workspaceAiWeight.upsert({
      where: { workspace },
      update: { weightConfig: clean, enabled: body.enabled !== false },
      create: { workspace, weightConfig: clean, enabled: body.enabled !== false },
    })
    return { code: 0, data: row }
  })
}
