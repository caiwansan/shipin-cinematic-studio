// ============================================================
// GEO MVP Routes — 10 API endpoints for 4-step workflow
// /api/v1/geo/*
// ============================================================

import { FastifyInstance } from 'fastify'
import { prisma } from '../../../utils/index.js'
import { scanBrand, getScanResult, getScanResultsByProject, getLatestScanByProject } from './geo-scan.service.js'

// ─── Helpers ───

type TierKey = 'free' | 'basic' | 'pro' | 'enterprise'

interface ScanQuota {
  maxMonthlyScans: number
  coolDownMinutes: number
  maxConcurrent: number
}

const TIER_QUOTAS: Record<TierKey, ScanQuota> = {
  free: {
    maxMonthlyScans: 3,
    coolDownMinutes: 60,
    maxConcurrent: 1,
  },
  basic: {
    maxMonthlyScans: 15,
    coolDownMinutes: 30,
    maxConcurrent: 1,
  },
  pro: {
    maxMonthlyScans: 50,
    coolDownMinutes: 10,
    maxConcurrent: 2,
  },
  enterprise: {
    maxMonthlyScans: 100,
    coolDownMinutes: 5,
    maxConcurrent: 3,
  },
}

function getQuotaFromTier(user: any): ScanQuota {
  const tier = (user.memberTier || '').toLowerCase() as TierKey
  const quota = TIER_QUOTAS[tier]
  if (quota) return quota
  // 未知等级 fallback -> free
  console.warn('[GEOScanQuota] Unknown tier:', tier, 'fallback to free')
  return TIER_QUOTAS.free
}

/** 从数据库补充用户的 memberTier（JWT decoded 不包含该字段） */
async function enrichUserTier(user: any): Promise<void> {
  try {
    const [dbUser, membership] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { memberTier: true },
      }),
      prisma.membership.findUnique({
        where: { userId: user.id },
        select: { tier: true },
      }),
    ])
    // SSOT: Membership.tier 优先，User.memberTier 为兼容 fallback
    const tier = membership?.tier || dbUser?.memberTier || 'free'
    user.memberTier = tier
  } catch {
    user.memberTier = 'free'
  }
}

function checkVip(user: any): boolean {
  // tier 来自 Membership.tier（SSOT），fallback User.memberTier
  // Pro（高级会员）/ enterprise（年卡）→ 有权限
  // basic（基础版）/ free → 无权限
  const tier = (user.memberTier || '').toLowerCase()
  const allowedTiers = ['enterprise', 'pro']
  return allowedTiers.includes(tier)
}

export default async function geoMvpRoutes(fastify: FastifyInstance) {

  // =============================================================
  // 1. DASHBOARD — 用户品牌列表
  // =============================================================
  fastify.get('/api/v1/geo/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    await enrichUserTier(user)
    if (!checkVip(user)) return reply.status(403).send({ error: '仅高级VIP用户可用' })

    const projects = await prisma.gEOProject.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    })

    // 附上每个项目的最新扫描结果
    const data = await Promise.all(projects.map(async (p) => {
      const latest = await getLatestScanByProject(p.id)
      return {
        id: p.id,
        name: p.name,
        website: p.website || '',
        industry: p.industry || '',
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        latestScan: latest ? {
          scanId: latest.id,
          overallScore: latest.overallScore,
          scanStatus: latest.scanStatus,
          scanFinishedAt: latest.scanFinishedAt?.toISOString() || null,
        } : null,
      }
    }))

    return { success: true, data }
  })

  // =============================================================
  // 2. CREATE PROJECT — 创建品牌
  // =============================================================
  fastify.post('/api/v1/geo/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    await enrichUserTier(user)
    if (!checkVip(user)) return reply.status(403).send({ error: '仅高级VIP用户可用' })

    const body = request.body as any
    if (!body.name) return reply.status(400).send({ error: '品牌名必填' })

    // 检查品牌上限
    const projectCount = await prisma.gEOProject.count({
      where: { userId: user.id, deletedAt: null },
    })
    if (projectCount >= 10) {
      return reply.status(403).send({ error: '已达品牌创建上限（10个）' })
    }

    const project = await prisma.gEOProject.create({
      data: {
        userId: user.id,
        name: body.name,
        website: body.website || null,
        industry: body.industry || null,
        keywords: body.keywords || [],
        language: body.language || 'zh',
        status: 'active',
        config: {},
      },
    })

    return { success: true, data: project }
  })

  // =============================================================
  // 3. GET PROJECT — 品牌详情
  // =============================================================
  fastify.get('/api/v1/geo/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    await enrichUserTier(user)
    if (!checkVip(user)) return reply.status(403).send({ error: '仅高级VIP用户可用' })

    const { id } = request.params as any
    const project = await prisma.gEOProject.findUnique({ where: { id } })
    if (!project || project.deletedAt) return reply.status(404).send({ error: '品牌不存在' })

    const latest = await getLatestScanByProject(project.id)

    return {
      success: true,
      data: {
        id: project.id,
        name: project.name || project.website || '',
        userId: project.userId,
        website: project.website || '',
        industry: project.industry || '',
        language: project.language || 'zh',
        country: project.country || '',
        status: project.status || 'active',
        keywords: project.keywords || [],
        projectId: project.id,
        brand: {
          name: project.name || project.website || '',
          website: project.website || '',
          industry: project.industry || '',
          language: project.language || 'zh',
          status: project.status || 'active',
        },
        healthScore: latest ? {
          overall: latest.overallScore || 0,
          change: 0,
          dimensions: {
            visibility: latest.visibilityScore || 0,
            accuracy: latest.accuracyScore || 0,
            consistency: latest.consistencyScore || 0,
            recommendation: latest.recommendationScore || 0,
          },
          trend: 'stable',
        } : null,
        latestScan: latest ? {
          scanId: latest.id,
          overallScore: latest.overallScore,
          visibilityScore: latest.visibilityScore,
          accuracyScore: latest.accuracyScore,
          consistencyScore: latest.consistencyScore,
          recommendationScore: latest.recommendationScore,
          scanStatus: latest.scanStatus,
          scanFinishedAt: latest.scanFinishedAt?.toISOString() || null,
          optimizationItems: latest.optimizationItems,
        } : null,
      },
    }
  })

  // =============================================================
  // 4. UPDATE PROJECT — 编辑品牌
  // =============================================================
  fastify.put('/api/v1/geo/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    await enrichUserTier(user)
    if (!checkVip(user)) return reply.status(403).send({ error: '仅高级VIP用户可用' })

    const { id } = request.params as any
    const body = request.body as any

    const project = await prisma.gEOProject.update({
      where: { id, userId: user.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.website !== undefined ? { website: body.website } : {}),
        ...(body.industry !== undefined ? { industry: body.industry } : {}),
        ...(body.keywords !== undefined ? { keywords: body.keywords } : {}),
        ...(body.language !== undefined ? { language: body.language } : {}),
      },
    })

    return { success: true, data: project }
  })

  // =============================================================
  // 5. START SCAN — 发起扫描（异步）
  // =============================================================
  fastify.post('/api/v1/geo/projects/:id/scan', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const user = request.user as any
      await enrichUserTier(user)

      if (!checkVip(user)) return reply.status(403).send({ error: '仅高级VIP用户可用' })

      const { id } = request.params as any
      const body = (request.body || {}) as any

      // 验证项目存在
      const project = await prisma.gEOProject.findUnique({ where: { id } })
      if (!project || project.deletedAt) return reply.status(404).send({ error: '品牌不存在' })

      // 获取该用户的 VIP 配额
      const quota = getQuotaFromTier(user)

      // 检查冷却期（按 VIP 等级配置）
      const latestScan = await getLatestScanByProject(id)
      if (latestScan && latestScan.scanStatus === 'completed') {
        const elapsed = Date.now() - new Date(latestScan.scanFinishedAt || latestScan.createdAt).getTime()
        const coolDownMs = quota.coolDownMinutes * 60 * 1000
        if (elapsed < coolDownMs) {
          const remaining = Math.ceil((coolDownMs - elapsed) / 60000)
          return reply.status(429).send({ error: `冷却中，请 ${remaining} 分钟后重试（您的套餐冷却期：${quota.coolDownMinutes}分钟）` })
        }
      }

      // 检查并发（按 VIP 等级配置）
      const runningCount = await prisma.gEOScanRecord.count({
        where: { userId: user.id, scanStatus: 'running' },
      })
      if (runningCount >= quota.maxConcurrent) {
        return reply.status(429).send({ error: `已有扫描任务进行中，请稍后（最多同时${quota.maxConcurrent}个）` })
      }

      // 检查月扫描上限（按 VIP 等级配置）
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthlyCount = await prisma.gEOScanRecord.count({
        where: {
          userId: user.id,
          createdAt: { gte: monthStart },
        },
      })
      if (monthlyCount >= quota.maxMonthlyScans) {
        return reply.status(429).send({ error: `本月扫描次数已达上限（${quota.maxMonthlyScans}次/月），升级 VIP 套餐或等下月再试` })
      }

      // 发起扫描
      const targetModels = body.targetModels || undefined
      const result = await scanBrand(id, user.id, targetModels)

      return {
        success: true,
        data: {
          scanId: result.scanId,
          status: 'running',
          estimatedSeconds: 90,
        },
      }
    } catch (err: any) {
      console.error('[GEOScanRoute] Scan failed:', err)
      return reply.status(500).send({ error: '扫描启动失败', message: err.message })
    }
  })

  // =============================================================
  // 6. GET SCAN RESULT — 获取扫描结果
  // =============================================================
  fastify.get('/api/v1/geo/projects/:id/scans/:scanId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { scanId } = request.params as any

    const scan = await getScanResult(scanId)
    if (!scan) return reply.status(404).send({ error: '扫描记录不存在' })

    // 解析 aiResponses
    const responses = scan.aiResponses as any[] || []
    const validCount = responses.filter((r: any) => r?.success).length
    const totalCount = responses.length

    // 如果正在扫描中
    if (scan.scanStatus === 'running' || scan.scanStatus === 'pending') {
      return {
        success: true,
        data: {
          scanId: scan.id,
          status: scan.scanStatus,
          progress: totalCount > 0 ? `${validCount}/${totalCount}` : null,
          estimatedSeconds: 90,
        },
      }
    }

    // 已完成或失败
    return {
      success: true,
      data: {
        scanId: scan.id,
        status: scan.scanStatus,
        overallScore: scan.overallScore || 0,
        dimensions: {
          visibility: { score: scan.visibilityScore || 0, explanation: getDimensionExplanation('visibility', scan.visibilityScore) },
          accuracy: { score: scan.accuracyScore || 0, explanation: getDimensionExplanation('accuracy', scan.accuracyScore) },
          consistency: { score: scan.consistencyScore || 0, explanation: getDimensionExplanation('consistency', scan.consistencyScore) },
          recommendation: { score: scan.recommendationScore || 0, explanation: getDimensionExplanation('recommendation', scan.recommendationScore) },
        },
        problems: (scan.optimizationItems as any[] || []).map((item: any) => ({
          dimension: item.dimension,
          severity: item.score && item.score < 30 ? 'high' : 'medium',
          description: item.description,
          optimizationSuggestion: item.suggestion,
        })),
        optimizationItems: (scan.optimizationItems as any[] || []).map((item: any) => ({
          dimension: item.dimension,
          description: item.description,
          suggestion: item.suggestion,
        })),
        durationMs: scan.durationMs || 0,
        scanFinishedAt: scan.scanFinishedAt?.toISOString() || null,
        errorMessage: scan.errorMessage || null,
      },
    }
  })

  // =============================================================
  // 7. GET SCAN LIST — 扫描列表（历史）
  // =============================================================
  fastify.get('/api/v1/geo/projects/:id/scans', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any

    const scans = await getScanResultsByProject(id)

    return {
      success: true,
      data: scans.map(s => ({
        scanId: s.id,
        status: s.scanStatus,
        overallScore: s.overallScore,
        durationMs: s.durationMs,
        scanStartedAt: s.scanStartedAt?.toISOString() || null,
        scanFinishedAt: s.scanFinishedAt?.toISOString() || null,
      })),
    }
  })

  // =============================================================
  // 8. GENERATE OPTIMIZATION — 生成优化建议
  // =============================================================
  fastify.post('/api/v1/geo/projects/:id/scans/:scanId/optimize', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { scanId } = request.params as any
      const body = (request.body || {}) as any

      const scan = await getScanResult(scanId)
      if (!scan) return reply.status(404).send({ error: '扫描记录不存在' })

      const items = (scan as any).optimizationItems as any[] || []
      const dimension = body.dimension

      // 如果指定了维度，返回该维度的建议
      if (dimension) {
        const item = items.find(i => i.dimension === dimension)
        if (!item) return reply.status(404).send({ error: `维度 ${dimension} 没有优化建议` })
        return {
          success: true,
          data: {
            dimension: item.dimension,
            description: item.description,
            suggestion: item.suggestion,
            structuredData: null,
          },
        }
      }

      // 返回所有建议
      return {
        success: true,
        data: items.map(item => ({
          dimension: item.dimension,
          description: item.description,
          suggestion: item.suggestion,
          structuredData: null,
        })),
      }
    } catch (err: any) {
      console.error('[GEOScanRoute] Optimize failed:', err)
      return reply.status(500).send({ error: '获取优化建议失败', message: err.message })
    }
  })

  // =============================================================
  // 9. MARK OPTIMIZATION APPLIED — 标记优化已应用（持久化）
  // =============================================================
  fastify.post('/api/v1/geo/projects/:id/scans/:scanId/apply', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id: projectId, scanId } = request.params as any
      const body = (request.body || {}) as any
      const dimension = body.dimension || body.suggestionId || ''

      // 更新数据库：标记该优化项为已应用
      const scan = await prisma.gEOScanRecord.findUnique({ where: { id: scanId } })
      if (!scan) return reply.status(404).send({ error: '扫描记录不存在' })

      const optimizationItems: any[] = (scan.optimizationItems as any[]) || []
      const updatedItems = optimizationItems.map(item => {
        if (!dimension || item.dimension === dimension) {
          return { ...item, appliedAt: new Date().toISOString(), applied: true }
        }
        return item
      })

      await prisma.gEOScanRecord.update({
        where: { id: scanId },
        data: {
          optimizationItems: updatedItems as any,
        },
      })

      return {
        success: true,
        data: {
          applied: true,
          dimension: dimension || null,
          appliedAt: new Date().toISOString(),
        },
      }
    } catch (err: any) {
      console.error('[GEOScanRoute] Apply optimization failed:', err)
      return reply.status(500).send({ error: '应用优化失败', message: err.message })
    }
  })

  // =============================================================
  // 10. PING — 健康检查
  // =============================================================
  // Note: /api/v1/geo/ping is registered elsewhere, use /api/v1/geo/mvp/ping
  fastify.get('/api/v1/geo/mvp/ping', async (_request, reply) => {
    return { success: true, version: '2.0.0', name: 'GEO MVP', status: 'ready' }
  })
}

// ─── Helpers ───

function getDimensionExplanation(dimension: string, score: number | null): string {
  if (score === null || score === undefined) return '暂无数据'
  if (score >= 80) {
    switch (dimension) {
      case 'visibility': return '大部分 AI 模型能准确识别该品牌'
      case 'accuracy': return 'AI 对品牌的描述准确性较高'
      case 'consistency': return '不同 AI 模型对品牌的描述高度一致'
      case 'recommendation': return 'AI 对品牌整体持正面评价'
      default: return '表现良好'
    }
  }
  if (score >= 50) {
    switch (dimension) {
      case 'visibility': return '部分 AI 模型可以识别该品牌'
      case 'accuracy': return '部分 AI 描述存在偏差'
      case 'consistency': return '各模型描述存在一定差异'
      case 'recommendation': return 'AI 评价偏中性'
      default: return '表现一般'
    }
  }
  switch (dimension) {
    case 'visibility': return '大多数 AI 模型无法识别该品牌'
    case 'accuracy': return 'AI 描述存在较多不准确信息'
    case 'consistency': return '不同 AI 模型对品牌的描述差异较大'
    case 'recommendation': return 'AI 对品牌的评价偏负面'
    default: return '需改善'
  }
}
