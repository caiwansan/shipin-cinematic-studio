// ============================================================
// GEO Explain Route — P0-T003 Explain Everywhere MVP
// GET /api/geo/brands/:id/explain
//
// SSOT: 所有 explain 数据来自 EngineResult (project + discovery + evidence)
//       页面不得自行拼装 explain 或 recommendation
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { geoClaimRepository } from '../repositories/geo-claim.repository.js'

interface ExplainEvidence {
  id: string
  source: 'website' | 'structuredData' | 'search' | 'aiConversation' | 'knowledgeBase'
  content: string
  confidence: number
  createdAt: string
}

interface ExplainReason {
  code: string
  message: string
}

interface ExplainExplain {
  summary: string
  confidence: number
  limitations: string[]
  reasons: ExplainReason[]
}

interface ExplainRecommendation {
  action: string
  priority: 'high' | 'medium' | 'low'
  difficulty: 'easy' | 'medium' | 'hard'
  expectedImpact: string
  estimatedGain: number
}

interface ExplainResponse {
  score: number
  status: string
  evidence: ExplainEvidence[]
  explain: ExplainExplain
  recommendations: ExplainRecommendation[]
}

/** 不同分数段对应的 explain 描述 */
function generateExplainSummary(score: number, entityCount: number, evidenceCount: number): string {
  if (score === 0) {
    return '尚未开始分析，暂无可用评分数据。请运行 Quick Discovery 来获取 ADI 评分。'
  }

  const reasons: string[] = []
  if (entityCount === 0) reasons.push('未提取到品牌相关实体')
  if (evidenceCount === 0) reasons.push('缺少支撑证据')
  if (score < 30) reasons.push('品牌信息在 AI 生态中几乎不可见')

  if (reasons.length > 0) {
    return `ADI ${score} — ` + reasons.join('，') + '。需从基础优化开始。'
  }

  if (score < 60) {
    return `ADI ${score} — 品牌有基础可见度，但存在明显优化空间。官网和知识源的完整性有待提升。`
  }

  if (score < 80) {
    return `ADI ${score} — 品牌具备较好的 AI 可见度，仍有优化潜力。建议完善结构化数据和知识图谱。`
  }

  return `ADI ${score} — 品牌在 AI 生态中可见度优秀。继续保持知识源更新，监控关键指标变化。`
}

/** 基于分数和证据的可信度 */
function calculateConfidence(evidenceCount: number, entityCount: number): number {
  if (evidenceCount === 0 && entityCount === 0) return 0
  const base = Math.min(evidenceCount * 10, 40)
  const entityBase = Math.min(entityCount * 8, 40)
  const bonus = evidenceCount > 0 && entityCount > 0 ? 15 : 0
  return Math.min(100, base + entityBase + bonus)
}

/** 生成 evidence（从 project + scan data + repository 提取） */
async function buildEvidence(
  project: any,
  scanRecords: any[],
  evidenceDb: any[],
  entityCount: number
): Promise<ExplainEvidence[]> {
  const evidence: ExplainEvidence[] = []
  const now = new Date().toISOString()

  // 1. Website evidence — 来自 project config
  if (project.config?.website || project.website) {
    evidence.push({
      id: 'ev-website',
      source: 'website',
      content: `官网可访问: ${project.website || project.config.website || ''}`,
      confidence: 80,
      createdAt: project.updatedAt || now,
    })
  }

  // 2. Structured data evidence — 如果有 entity/claim 则标记
  if (evidenceDb.length > 0) {
    const structuredEvidences = evidenceDb.filter(
      (e: any) => e.sourceType === 'structured_data' || e.type === 'structuredData'
    )
    if (structuredEvidences.length > 0) {
      evidence.push({
        id: 'ev-sd',
        source: 'structuredData',
        content: `检测到 ${structuredEvidences.length} 条结构化数据证据`,
        confidence: 75,
        createdAt: structuredEvidences[0].createdAt || now,
      })
    }
  }

  // 3. Search evidence — 来自 scan records
  if (scanRecords.length > 0) {
    evidence.push({
      id: 'ev-search',
      source: 'search',
      content: `已完成 ${scanRecords.length} 次发现扫描`,
      confidence: 85,
      createdAt: scanRecords[0].createdAt || now,
    })
  }

  // 4. Knowledge base evidence — entity count
  if (entityCount > 0) {
    evidence.push({
      id: 'ev-kb',
      source: 'knowledgeBase',
      content: `知识库包含 ${entityCount} 个实体/对象`,
      confidence: 70,
      createdAt: now,
    })
  }

  return evidence
}

/** 生成 reason 列表 */
function generateReasons(score: number, evidence: ExplainEvidence[], entityCount: number): ExplainReason[] {
  const reasons: ExplainReason[] = []

  if (!evidence.some((e) => e.source === 'website')) {
    reasons.push({ code: 'WEBSITE_MISSING', message: '官网信息未配置或不可访问' })
  }
  if (!evidence.some((e) => e.source === 'structuredData')) {
    reasons.push({ code: 'SCHEMA_MISSING', message: '未检测到 Schema 结构化数据标记' })
  }
  if (!evidence.some((e) => e.source === 'search')) {
    reasons.push({ code: 'SEARCH_NOT_RUN', message: '尚未运行发现扫描' })
  }
  if (entityCount === 0) {
    reasons.push({ code: 'KNOWLEDGE_EMPTY', message: '知识库为空，未提取到实体' })
  }
  if (score < 30) {
    reasons.push({ code: 'SCORE_LOW', message: 'ADI 评分较低，品牌可见度不足' })
  }

  if (reasons.length === 0) {
    reasons.push({ code: 'SCORE_GOOD', message: '品牌信息完整，AI 可见度良好' })
  }

  return reasons
}

/** 生成 limitations */
function generateLimitations(evidence: ExplainEvidence[]): string[] {
  const limitations: string[] = []

  if (!evidence.some((e) => e.source === 'search')) {
    limitations.push('尚未运行 Ai Discovery 扫描 — 分数可能不完整')
  }
  if (!evidence.some((e) => e.source === 'aiConversation')) {
    limitations.push('未验证 AI 平台实际对话结果 — 可见度判断基于间接证据')
  }
  limitations.push('评分基于当前可用数据，可能忽略近期变化')

  return limitations
}

/** 生成 recommendation（Recommendation Engine 输出） */
function generateRecommendations(score: number, evidence: ExplainEvidence[], entityCount: number): ExplainRecommendation[] {
  const recommendations: ExplainRecommendation[] = []

  // 至少 3 条 recommendation
  if (!evidence.some((e) => e.source === 'website') || !projectHasWebsite(evidence)) {
    recommendations.push({
      action: '配置官网 URL 并确保可访问',
      priority: 'high',
      difficulty: 'easy',
      expectedImpact: 'ADI +5~10',
      estimatedGain: 60,
    })
  }

  if (!evidence.some((e) => e.source === 'structuredData')) {
    recommendations.push({
      action: '在官网添加 Schema.org 结构化数据标记',
      priority: 'high',
      difficulty: 'medium',
      expectedImpact: 'ADI +6~12',
      estimatedGain: 70,
    })
  }

  if (entityCount === 0) {
    recommendations.push({
      action: '运行实体提取，构建品牌知识图谱',
      priority: 'high',
      difficulty: 'medium',
      expectedImpact: 'ADI +4~10',
      estimatedGain: 65,
    })
  }

  if (!evidence.some((e) => e.source === 'search')) {
    recommendations.push({
      action: '运行 Quick Discovery 获取品牌基线评分',
      priority: 'high',
      difficulty: 'easy',
      expectedImpact: 'ADI +0~2（获取基线）',
      estimatedGain: 30,
    })
  }

  if (score < 60 && evidence.some((e) => e.source === 'website')) {
    recommendations.push({
      action: '完善品牌描述与 FAQ 内容',
      priority: 'medium',
      difficulty: 'easy',
      expectedImpact: 'ADI +3~6',
      estimatedGain: 50,
    })
  }

  if (score >= 60 && score < 80) {
    recommendations.push({
      action: '扩展知识源：添加行业白皮书、案例研究等权威内容',
      priority: 'medium',
      difficulty: 'hard',
      expectedImpact: 'ADI +5~8',
      estimatedGain: 55,
    })
  }

  if (score >= 80) {
    recommendations.push({
      action: '持续监控 ADI 趋势，设置评分漂移告警',
      priority: 'low',
      difficulty: 'easy',
      expectedImpact: 'ADI +0~2（防止衰减）',
      estimatedGain: 25,
    })
  }

  // 保证至少 3 条
  const fallbacks: ExplainRecommendation[] = [
    {
      action: '运行 Quick Discovery 开始分析',
      priority: 'high',
      difficulty: 'easy',
      expectedImpact: 'ADI +0~2（获取基线）',
      estimatedGain: 30,
    },
    {
      action: '完善品牌资料（名称、官网、行业）',
      priority: 'high',
      difficulty: 'easy',
      expectedImpact: 'ADI +3~5',
      estimatedGain: 40,
    },
    {
      action: '添加知识源（文档、FAQ、产品信息）',
      priority: 'medium',
      difficulty: 'medium',
      expectedImpact: 'ADI +4~8',
      estimatedGain: 50,
    },
  ]

  while (recommendations.length < 3) {
    const fb = fallbacks[recommendations.length % fallbacks.length]
    if (!recommendations.find((r) => r.action === fb.action)) {
      recommendations.push(fb)
    } else {
      break
    }
  }

  return recommendations.slice(0, 6) // 最多 6 条
}

function projectHasWebsite(evidence: ExplainEvidence[]): boolean {
  return evidence.some((e) => e.source === 'website')
}

export default async function geoExplainRoutes(fastify: FastifyInstance) {
  // GET /api/geo/brands/:id/explain — 获取品牌 Explain 数据
  fastify.get('/api/geo/brands/:id/explain', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const project = await geoProjectRepository.findUnique({ where: { id } })
      if (!project || project.deletedAt) {
        return reply.status(404).send({ success: false, error: '品牌未找到' })
      }

      // Extract ADI from project config
      const adi = project.config?.adi || 0
      const entityCount = project.config?.entityCount || 0

      // Load scan history
      const scanRecords = await geoScanHistoryRepository.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
      })

      // Load evidence from DB — only from project config (no GEOEvidence table dependency)
      const evidenceDb: any[] = []

      // Build Evidence list
      const evidence = await buildEvidence(project, scanRecords, evidenceDb, entityCount)

      // Empty state check: no analysis done yet
      if (adi === 0 && evidence.length === 0) {
        const response: ExplainResponse = {
          score: 0,
          status: 'NO_ANALYSIS',
          evidence: [],
          explain: {
            summary: '暂无分析数据。请运行 Quick Discovery 来生成品牌 Explain。',
            confidence: 0,
            limitations: ['未运行任何分析，无可用数据'],
            reasons: [],
          },
          recommendations: [
            {
              action: '运行 Quick Discovery 开始分析',
              priority: 'high',
              difficulty: 'easy',
              expectedImpact: 'ADI +0~2（获取基线）',
              estimatedGain: 30,
            },
            {
              action: '完善品牌资料（名称、官网、行业）',
              priority: 'high',
              difficulty: 'easy',
              expectedImpact: 'ADI +3~5',
              estimatedGain: 40,
            },
            {
              action: '添加知识源（文档、FAQ、产品信息）',
              priority: 'medium',
              difficulty: 'medium',
              expectedImpact: 'ADI +4~8',
              estimatedGain: 50,
            },
          ],
        }
        return reply.send({ success: true, data: response })
      }

      // Build Explain
      const reasons = generateReasons(adi, evidence, entityCount)
      const limitations = generateLimitations(evidence)
      const confidence = calculateConfidence(evidence.length, entityCount)

      const response: ExplainResponse = {
        score: adi,
        status: adi > 0 ? 'ANALYZED' : 'NO_SCORE',
        evidence,
        explain: {
          summary: generateExplainSummary(adi, entityCount, evidence.length),
          confidence,
          limitations,
          reasons,
        },
        recommendations: generateRecommendations(adi, evidence, entityCount),
      }

      return reply.send({ success: true, data: response })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
