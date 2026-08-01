/**
 * routes/enterprise-channel-center.routes.ts — 招聘渠道中心（Phase 1）
 *
 * 掌柜蓝图（2026-08-01）：「添加渠道 = 授权 AI 招聘团队把企业岗位投放、同步、追踪到外部招聘生态」
 * Phase 1（现在）: 渠道管理模型 + 渠道配置页 + 渠道数据统计 + 手动导入候选人
 *   - 诚实状态：所有渠道统一「接入准备中」，不显示已连接（无真实 API 授权不假装）
 * Phase 2: 接真实 API（Boss Open API / 猎聘企业 API / 智联 API）→ 岗位同步
 * Phase 3: AI 招聘闭环（发布 → 曝光分析 → 主动搜寻 → AI 邀约 → AI 面试 → 录用预测）
 *
 * KMKI 渠道原则（与 BYOK 模型原则一致）:
 *   - 渠道 Token 属于企业资产，昆仑镜不保存平台账号
 *   - AI 员工通过企业授权使用渠道
 *   - 渠道产生的候选人与数据归企业 Organization
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { resolveEnterpriseId } from '../services/enterprise-context.service.js'
import { requireEnterpriseCapability } from '../middleware/require-enterprise-capability.js'

/** 渠道定位（Phase 1 内置文案，来自掌柜渠道蓝图）— 按平台名优先 */
const CHANNEL_POSITIONING: Record<string, string> = {
  'Boss直聘': '大量招聘：岗位同步 + 候选人同步，AI 自动筛选',
  猎聘: '中高级人才猎取：AI 猎头主动搜寻 + 邀约话术',
  智联招聘: '校招 / 普通岗位 / 大规模招聘',
  前程无忧: '综合招聘：覆盖广，适合常规岗位',
  拉勾网: '互联网垂直：技术 / 产品 / 运营岗位',
  脉脉: '职场社交：人脉推荐 + 雇主品牌',
  内推渠道: '员工推荐 + 熟人网络',
  校园招聘: '应届生批量招募',
}

const CHANNEL_ICONS: Record<string, string> = {
  'Boss直聘': '💼',
  猎聘: '🎯',
  智联招聘: '🎓',
  前程无忧: '📋',
  拉勾网: '🐸',
  脉脉: '🤝',
  内推渠道: '🌟',
  校园招聘: '🏫',
}

const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  new: '新候选人',
  screening: '筛选中',
  interviewing: '面试中',
  hired: '已录用',
  rejected: '已淘汰',
}

export const enterpriseChannelCenterRoutes = async (fastify: FastifyInstance) => {
  // ─── JWT Auth for all routes ───
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  /**
   * GET /api/enterprise/channel-center/overview
   * 渠道中心聚合统计：每渠道 发布岗位数 / 收到候选 / AI 筛选 / 转化率
   */
  fastify.get('/api/enterprise/channel-center/overview', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const enterpriseId = await resolveEnterpriseId(userId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      const [channels, mappings, candidates] = await Promise.all([
        prisma.recruitmentChannel.findMany({
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' },
        }),
        prisma.recruitmentChannelMapping.findMany({
          where: { job: { enterpriseId } },
          select: { channelId: true, status: true },
        }),
        prisma.enterpriseCandidate.findMany({
          where: { organizationId: enterpriseId },
          select: { channelId: true, status: true, aiAnalysis: true },
        }),
      ])

      const jobCountByChannel = new Map<string, number>()
      for (const m of mappings) {
        jobCountByChannel.set(m.channelId, (jobCountByChannel.get(m.channelId) || 0) + 1)
      }
      const candByChannel = new Map<string, { total: number; aiScreened: number; hired: number }>()
      for (const c of candidates) {
        const agg = candByChannel.get(c.channelId) || { total: 0, aiScreened: 0, hired: 0 }
        agg.total++
        if (c.aiAnalysis) agg.aiScreened++
        if (c.status === 'hired') agg.hired++
        candByChannel.set(c.channelId, agg)
      }

      const items = channels.map((ch: any) => {
        const cand = candByChannel.get(ch.id) || { total: 0, aiScreened: 0, hired: 0 }
        return {
          channelId: ch.id,
          name: ch.name,
          type: ch.type,
          icon: CHANNEL_ICONS[ch.name] || '📡',
          positioning: CHANNEL_POSITIONING[ch.name] || ch.description || '',
          // Phase 1 诚实状态：无真实 API 授权 → 一律「接入准备中」，不显示已连接
          integrationStatus: 'preparing',
          integrationStatusLabel: '接入准备中',
          stats: {
            jobCount: jobCountByChannel.get(ch.id) || 0,
            candidateCount: cand.total,
            aiScreened: cand.aiScreened,
            hired: cand.hired,
            conversionRate: cand.total > 0 ? Math.round((cand.hired / cand.total) * 100) : 0,
          },
        }
      })

      return reply.send({ success: true, channels: items, phase: 1 })
    } catch (error: any) {
      request.log.error(`[channel-center] overview: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to fetch channel overview' })
    }
  })

  /**
   * POST /api/enterprise/channel-center/import
   * 手动导入候选人（渠道入口 → 昆仑镜 AI 筛选/面试/评估）
   * body: { channelId, jobId?, name, phone?, email?, skills[], experienceYears?, summary?, expectedSalary? }
   * AI 评价：企业配置了模型则真实生成；未配置 → aiAnalysis=null（诚实显示未生成）
   */
  fastify.post('/api/enterprise/channel-center/import', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const enterpriseId = await resolveEnterpriseId(userId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }
      const body = (request.body || {}) as any
      const { channelId, jobId, name, phone, email, skills = [], experienceYears = 0, summary, expectedSalary } = body
      if (!channelId || !name) {
        return reply.status(400).send({ error: 'channelId and name are required' })
      }
      const channel = await prisma.recruitmentChannel.findUnique({ where: { id: channelId } })
      if (!channel) {
        return reply.status(400).send({ error: 'Invalid channelId' })
      }

      // AI 评价：企业模型真实生成（BYOK），未配置/失败 → null（不假装）
      let aiAnalysis: string | null = null
      try {
        const { modelResolver } = await import('../services/enterprise/model-resolver.service.js')
        const resolved = await modelResolver.resolveEnterpriseModel({ organizationId: enterpriseId })
        if (resolved && resolved.healthStatus !== 'failed' && resolved.healthStatus !== 'decrypt_error' && resolved.healthStatus !== 'disabled') {
          const { executeViaGateway } = await import('../runtime/runtime-gateway.js')
          const prompt = `你是一位资深 AI 招聘顾问。请根据以下渠道导入的候选人信息，输出 2-3 句专业评价（中文），涵盖：①核心亮点 ②潜在风险/需核实点 ③建议的面试考察方向。不要输出 Markdown 格式，直接输出评价文本。\n\n姓名：${name}\n技能：${Array.isArray(skills) ? skills.join('、') : '未知'}\n经验年限：${experienceYears} 年\n个人简介：${summary || '未提供'}\n期望薪资：${expectedSalary || '未提供'}\n来源渠道：${channel.name}`
          const result = await executeViaGateway('llm', {
            prompt,
            maxTokens: 512,
            temperature: 0.6,
          }, {
            userId,
            tenantId: enterpriseId,
            provider: resolved.provider,
            model: resolved.model,
            apiKey: resolved.apiKey,
            baseUrl: resolved.baseUrl,
            businessType: 'recruitment',
          })
          if (result?.content) {
            aiAnalysis = result.content.trim().slice(0, 1000)
          }
        }
      } catch (e: any) {
        request.log.warn(`[channel-center] ai analysis skipped: ${e.message}`)
        // AI 评价失败不阻断导入（诚实显示未生成）
      }

      const candidate = await prisma.enterpriseCandidate.create({
        data: {
          organizationId: enterpriseId,
          channelId,
          jobId: jobId || null,
          name,
          phone: phone || null,
          email: email || null,
          skills: Array.isArray(skills) ? skills : [],
          experienceYears: Number(experienceYears) || 0,
          summary: summary || null,
          expectedSalary: expectedSalary || null,
          status: 'new',
          aiAnalysis,
          importedBy: userId,
        },
      })

      // SPRINT-AGENT-OUTCOME-01: 真实结果登记（统一 Outcome Layer）
      try {
        const { outcomeRegistry } = await import('../services/enterprise/outcome-registry.service.js')
        await outcomeRegistry.record({
          organizationId: enterpriseId,
          userId,
          workspace: 'recruitment',
          outcomeType: 'CANDIDATE_RECEIVED',
          sourceExecutionId: candidate.id,
          metadata: { candidateId: candidate.id, name, channelId, channelName: channel.name, jobId: jobId || null },
        })
        if (aiAnalysis) {
          await outcomeRegistry.record({
            organizationId: enterpriseId,
            userId,
            workspace: 'recruitment',
            outcomeType: 'EVALUATION_GENERATED',
            sourceExecutionId: candidate.id,
            metadata: { candidateId: candidate.id, name, model: 'enterprise-byok' },
          })
        }
      } catch (oe: any) {
        request.log.warn(`[channel-center] outcome record skipped: ${oe.message}`)
      }

      return reply.send({ success: true, candidate, aiAnalysisGenerated: !!aiAnalysis })
    } catch (error: any) {
      request.log.error(`[channel-center] import: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to import candidate' })
    }
  })

  /**
   * GET /api/enterprise/channel-center/candidates
   * 渠道候选人列表（渠道入口进入昆仑镜的候选人，归企业 Organization）
   * query: channelId?, status?, page?, pageSize?
   */
  fastify.get('/api/enterprise/channel-center/candidates', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const enterpriseId = await resolveEnterpriseId(userId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }
      const { channelId, status, page = '1', pageSize = '50' } = request.query as any
      const where: any = { organizationId: enterpriseId }
      if (channelId) where.channelId = channelId
      if (status) where.status = status

      const [total, candidates] = await Promise.all([
        prisma.enterpriseCandidate.count({ where }),
        prisma.enterpriseCandidate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Math.max(1, parseInt(page, 10) || 1) - 1) * Math.min(100, parseInt(pageSize, 10) || 50),
          take: Math.min(100, parseInt(pageSize, 10) || 50),
          include: {
            channel: { select: { id: true, name: true, type: true } },
          },
        }),
      ])

      return reply.send({
        success: true,
        candidates: candidates.map((c: any) => ({
          ...c,
          statusLabel: CANDIDATE_STATUS_LABELS[c.status] || c.status,
        })),
        total,
      })
    } catch (error: any) {
      request.log.error(`[channel-center] candidates: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to fetch candidates' })
    }
  })

  /**
   * PATCH /api/enterprise/channel-center/candidates/:id
   * 候选人状态流转: new → screening → interviewing → hired / rejected
   * body: { status, aiAnalysis? }
   */
  fastify.patch('/api/enterprise/channel-center/candidates/:id', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const enterpriseId = await resolveEnterpriseId(userId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }
      const { id } = request.params as any
      const body = (request.body || {}) as any
      const allowed = ['new', 'screening', 'interviewing', 'hired', 'rejected']
      if (!body.status || !allowed.includes(body.status)) {
        return reply.status(400).send({ error: `status must be one of: ${allowed.join(', ')}` })
      }

      const existing = await prisma.enterpriseCandidate.findFirst({
        where: { id, organizationId: enterpriseId },
      })
      if (!existing) {
        return reply.status(404).send({ error: 'Candidate not found' })
      }

      const updated = await prisma.enterpriseCandidate.update({
        where: { id },
        data: {
          status: body.status,
          ...(body.aiAnalysis !== undefined ? { aiAnalysis: body.aiAnalysis } : {}),
        },
      })

      // SPRINT-AGENT-OUTCOME-01: 状态流转 → 真实结果登记
      try {
        const { outcomeRegistry } = await import('../services/enterprise/outcome-registry.service.js')
        const statusOutcome: Record<string, string> = {
          screening: 'CANDIDATE_SCREENED',
          interviewing: 'INTERVIEW_CREATED',
          hired: 'HIRING_RECOMMENDATION',
        }
        const outcomeType = statusOutcome[body.status]
        if (outcomeType) {
          await outcomeRegistry.record({
            organizationId: enterpriseId,
            userId,
            workspace: 'recruitment',
            outcomeType,
            sourceExecutionId: `${id}:${body.status}`,
            metadata: { candidateId: id, name: existing.name, fromStatus: existing.status, toStatus: body.status },
          })
        }
      } catch (oe: any) {
        request.log.warn(`[channel-center] outcome record skipped: ${oe.message}`)
      }

      return reply.send({ success: true, candidate: updated, statusLabel: CANDIDATE_STATUS_LABELS[updated.status] })
    } catch (error: any) {
      request.log.error(`[channel-center] patch candidate: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to update candidate' })
    }
  })
}

export default enterpriseChannelCenterRoutes
