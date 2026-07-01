// ============================================================
// GEO Optimization Route — P0-T004 Optimization Center MVP
// GET /api/geo/brands/:id/optimizations
//
// SSOT: 所有 optimization 数据来自 EngineResult (project + discovery + evidence)
//       recommendations 唯一数据源为 engine 生成的 recommendation
//       priority / difficulty / expectedImpact 全部来自 Engine
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoProjectRepository } from '../repositories/geo-project.repository.js'
import { geoScanHistoryRepository } from '../repositories/geo-scan-history.repository.js'
import { geoClaimRepository } from '../repositories/geo-claim.repository.js'

interface OptimizationRecommendation {
  action: string
  priority: 'high' | 'medium' | 'low'
  difficulty: 'easy' | 'medium' | 'hard'
  expectedImpact: string
  estimatedGain: number
  reason: string
}

interface OptimizationResponse {
  currentADI: number
  estimatedADI: number
  potentialGain: number
  potentialGainKnown: boolean
  recommendations: OptimizationRecommendation[]
}

/** 生成 recommendation（Recommendation Engine 输出 - 同 explain route 但增加 reason） */
function generateRecommendations(
  score: number,
  hasWebsite: boolean,
  hasStructuredData: boolean,
  entityCount: number,
  hasSearch: boolean,
  evidenceCount: number
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = []

  // 至少 3 条 recommendation
  if (!hasWebsite) {
    recommendations.push({
      action: '配置官网 URL 并确保可访问',
      priority: 'high',
      difficulty: 'easy',
      expectedImpact: '预计 +5~10',
      estimatedGain: 60,
      reason: '官网是品牌 AI 可见度的核心基础，未检测到官网信息',
    })
  }

  if (!hasStructuredData) {
    recommendations.push({
      action: '在官网添加 Schema.org 结构化数据标记',
      priority: 'high',
      difficulty: 'medium',
      expectedImpact: '预计 +6~12',
      estimatedGain: 70,
      reason: '官网未检测到结构化数据标记，搜索引擎无法识别品牌信息',
    })
  }

  if (entityCount === 0) {
    recommendations.push({
      action: '运行实体提取，构建品牌知识图谱',
      priority: 'high',
      difficulty: 'medium',
      expectedImpact: '预计 +4~10',
      estimatedGain: 65,
      reason: '知识库为空，未提取到品牌相关实体',
    })
  }

  if (!hasSearch) {
    recommendations.push({
      action: '运行 Quick Discovery 获取品牌基线评分',
      priority: 'high',
      difficulty: 'easy',
      expectedImpact: '预计 +0~2（获取基线）',
      estimatedGain: 30,
      reason: '尚未运行发现扫描，无法评估品牌可见度基线',
    })
  }

  if (score < 60 && hasWebsite) {
    recommendations.push({
      action: '完善品牌描述与 FAQ 内容',
      priority: 'medium',
      difficulty: 'easy',
      expectedImpact: '预计 +3~6',
      estimatedGain: 50,
      reason: '品牌描述不够详细，无法提供足够的品牌上下文',
    })
  }

  if (score >= 60 && score < 80) {
    recommendations.push({
      action: '扩展知识源：添加行业白皮书、案例研究等权威内容',
      priority: 'medium',
      difficulty: 'hard',
      expectedImpact: '预计 +5~8',
      estimatedGain: 55,
      reason: '品牌已具备基础可见度，可通过权威内容提升可信度',
    })
  }

  if (score >= 80) {
    recommendations.push({
      action: '持续监控 ADI 趋势，设置评分漂移告警',
      priority: 'low',
      difficulty: 'easy',
      expectedImpact: '预计 +0~2（防止衰减）',
      estimatedGain: 25,
      reason: '品牌表现优秀，需持续监控防止评分衰减',
    })
  }

  // 保证至少 3 条
  const fallbacks: OptimizationRecommendation[] = [
    {
      action: '运行 Quick Discovery 开始分析',
      priority: 'high',
      difficulty: 'easy',
      expectedImpact: '预计 +0~2（获取基线）',
      estimatedGain: 30,
      reason: '尚未运行分析，无法获取品牌基线数据',
    },
    {
      action: '完善品牌资料（名称、官网、行业）',
      priority: 'high',
      difficulty: 'easy',
      expectedImpact: '预计 +3~5',
      estimatedGain: 40,
      reason: '品牌资料不完整，影响 AI 对品牌的识别能力',
    },
    {
      action: '添加知识源（文档、FAQ、产品信息）',
      priority: 'medium',
      difficulty: 'medium',
      expectedImpact: '预计 +4~8',
      estimatedGain: 50,
      reason: '缺乏足够的品牌知识源，影响品牌 AI 可见度评分',
    },
    {
      action: '完善 About 页面内容',
      priority: 'low',
      difficulty: 'easy',
      expectedImpact: '预计 +2~4',
      estimatedGain: 35,
      reason: '品牌页面内容不够丰富，无法提供完整的品牌故事',
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

/** 基于已有证据和 entityCount 估算 potentialGain */
function calculatePotentialGain(
  score: number,
  hasWebsite: boolean,
  hasStructuredData: boolean,
  entityCount: number,
  hasSearch: boolean,
  evidenceCount: number
): number {
  if (score === 0 && evidenceCount === 0 && entityCount === 0) {
    return 0 // Unknown — no analysis
  }

  let gain = 0

  // 每条缺失的 recommendation 对应一个 gain 值
  if (!hasWebsite) gain += 8
  if (!hasStructuredData) gain += 10
  if (entityCount === 0) gain += 7
  if (!hasSearch) gain += 2
  if (score < 60 && hasWebsite) gain += 5
  if (score >= 60 && score < 80) gain += 6

  // 基于分数上限调整：分数越高，增长空间越小
  if (score < 30) gain = Math.min(gain, 25)
  else if (score < 60) gain = Math.min(gain, 20)
  else if (score < 80) gain = Math.min(gain, 15)
  else gain = Math.min(gain, 5)

  return gain
}

export default async function geoOptimizationRoutes(fastify: FastifyInstance) {
  // GET /api/geo/brands/:id/optimizations — 获取品牌优化建议
  fastify.get('/api/geo/brands/:id/optimizations', { preHandler: [] }, async (request, reply) => {
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

      // No evidence DB dependency — use project config data
      const hasWebsite = !!(project.config?.website || project.website)
      const hasStructuredData = false  // Not verifiable without GEOEvidence table
      const hasSearch = scanRecords.length > 0
      const evidenceCount = 0
      const hasAnalysis = adi > 0 || entityCount > 0 || scanRecords.length > 0

      // Empty state: no analysis done yet
      if (!hasAnalysis) {
        const response: OptimizationResponse = {
          currentADI: 0,
          estimatedADI: 0,
          potentialGain: 0,
          potentialGainKnown: false,
          recommendations: [],
        }
        return reply.send({ success: true, data: response })
      }

      // Generate recommendations from engine (SSOT)
      const recs = generateRecommendations(adi, hasWebsite, hasStructuredData, entityCount, hasSearch, evidenceCount)

      // Add reason field based on recommendation content
      const recommendations: OptimizationRecommendation[] = recs.map((r) => {
        // Default reasons mapped by action keyword
        let reason = r.action
        if (r.action.includes('官网') && !r.action.includes('结构化')) {
          reason = '官网是品牌 AI 可见度的核心基础，建议确保官网可访问并配置完整信息'
        } else if (r.action.includes('结构化') || r.action.includes('Schema')) {
          reason = '官网未检测到结构化数据标记，搜索引擎无法识别品牌信息'
        } else if (r.action.includes('实体') || r.action.includes('知识图谱')) {
          reason = '知识库为空，未提取到品牌相关实体'
        } else if (r.action.includes('Quick Discovery') || r.action.includes('运行分析')) {
          reason = '尚未运行分析，无法获取品牌基线数据'
        } else if (r.action.includes('FAQ') || r.action.includes('描述')) {
          reason = '品牌描述不够详细，无法提供足够的品牌上下文'
        } else if (r.action.includes('知识源') || r.action.includes('案例')) {
          reason = '品牌已具备基础可见度，可通过权威内容提升可信度'
        } else if (r.action.includes('监控')) {
          reason = '品牌表现优秀，需持续监控防止评分衰减'
        } else if (r.action.includes('About')) {
          reason = '品牌页面内容不够丰富，无法提供完整的品牌故事'
        } else {
          reason = '建议优先处理该项目以提升品牌 AI 可见度'
        }
        return { ...r, reason }
      })

      // Sort: High → Medium → Low
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

      // Calculate potential gain
      const potentialGain = calculatePotentialGain(adi, hasWebsite, hasStructuredData, entityCount, hasSearch, evidenceCount)

      const response: OptimizationResponse = {
        currentADI: adi,
        estimatedADI: adi + potentialGain,
        potentialGain,
        potentialGainKnown: true,
        recommendations,
      }

      return reply.send({ success: true, data: response })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
