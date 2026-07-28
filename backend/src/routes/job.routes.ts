/**
 * job.routes.ts — 昆仑镜 AI 求职招聘工作台 API
 *
 * 项目编号: KM-AI-JOB-WORKSPACE-01
 * Phase 1: AI求职MVP（求职者端）
 *
 * 路由列表：
 * - POST /api/job/chat          — AI 求职助手聊天（真实引擎）
 * - GET  /api/job/profile       — 获取求职者画像
 * - PUT  /api/job/profile       — 更新求职者画像
 * - GET  /api/job/recommendations — 获取推荐岗位
 * - GET  /api/job/postings      — 获取岗位列表
 * - POST /api/job/postings      — 发布岗位（企业）
 * - GET  /api/job/news          — 获取招聘动态
 * - GET  /api/job/statistics    — 获取招聘统计
 * - POST /api/job/resume/analyze — 简历分析（企业）
 * - POST /api/job/interview/generate — 面试助手（企业）
 */

import { FastifyInstance } from 'fastify'
import { resolveEnterpriseId } from '../services/enterprise-context.service.js'
import { prisma } from '../utils/index.js'
import { JobCareerEngine, CandidateProfile } from '../agents/job/job-career-engine.js'
import { matchJobs, generateMockJobs } from '../agents/job/job-matching.service.js'

// ─── 内存中的访谈状态（Phase 1 简化版，Phase 2 改为 Redis）───
const interviewSessions = new Map<string, JobCareerEngine>()

export default async function jobRoutes(fastify: FastifyInstance) {

  // ─── AI 求职助手聊天（Phase 1 核心）───

  fastify.post('/api/job/chat', async (request, reply) => {
    const body = request.body as {
      message?: string
      userId?: string
      reset?: boolean
    }

    if (!body.message) {
      return reply.status(400).send({ error: 'message is required' })
    }

    const userId = body.userId || 'anonymous'

    try {
      // 获取或创建访谈引擎
      let engine = interviewSessions.get(userId)

      if (body.reset || !engine) {
        // 尝试从数据库加载已有画像
        let existingProfile: Partial<CandidateProfile> | undefined
        if (userId !== 'anonymous') {
          const saved = await prisma.careerProfile.findFirst({
            where: { userId },
            select: {
              fullName: true,
              bio: true,
              headline: true,
              city: true,
              skills: { select: { name: true } },
              workExperiences: { take: 1, select: { title: true, company: true } },
              educations: { take: 1, select: { degree: true, field: true } },
            },
          })
          if (saved) {
            existingProfile = {
              name: saved.fullName || '',
              education: saved.educations?.[0]?.degree || saved.educations?.[0]?.field || '',
              skills: saved.skills?.map(s => s.name) || [],
              experience: saved.workExperiences?.[0]?.title || saved.headline || '',
              city: saved.city || '',
              salaryMin: 0,
              salaryMax: 0,
              careerGoal: saved.bio || '',
            }
          }
        }
        engine = new JobCareerEngine(existingProfile)
        interviewSessions.set(userId, engine)
      }

      // 处理消息
      const result = engine.processMessage(body.message)

      // ─── Sprint 12.5: JobCandidate @deprecated — 停止新数据写入 ───
      // Replaced by CareerProfile as single source of truth.
      // 历史数据保留，禁止新写入。
      // 原写入逻辑已注释：
      // if (userId !== 'anonymous' && result.profile) {
      //   const existing = await prisma.jobCandidate.findFirst({ where: { userId } })
      //   ...
      //   await prisma.jobCandidate.create/update(...)
      // }
      // 新数据写入请走 CareerProfile 体系：prisma.careerProfile.create/update()

      // 如果访谈完成，生成推荐
      let recommendations: any[] = []
      if (result.isComplete && result.profile) {
        // 从数据库获取真实岗位，如果没有则用模拟数据
        const dbJobs = await prisma.jobPosting.findMany({
          where: { status: 'active' },
          include: { enterprise: true },
          take: 20,
        })

        const jobPosts = dbJobs.length > 0
          ? dbJobs.map(j => ({
              id: j.id,
              title: j.title,
              company: j.enterprise?.industry || '入驻企业',
              salary: j.salary || '',
              location: j.location || '',
              description: j.description || '',
              requirements: j.requirements || '',
              qualityScore: j.qualityScore || 50,
            }))
          : generateMockJobs()

        recommendations = matchJobs(result.profile, jobPosts)

        // 保存推荐记录（Sprint-07A: 模型可能不存在，安全降级）
        if (userId !== 'anonymous') {
          try {
            const candidate = await prisma.careerProfile.findFirst({ where: { userId } })
            if (candidate) {
              for (const rec of recommendations.slice(0, 5)) {
                await (prisma as any).jobRecommendation?.create?.({
                  data: {
                    candidateId: candidate.id,
                    jobId: rec.jobId,
                    matchScore: rec.matchScore,
                    reason: rec.reasons.join('；'),
                    status: 'pending',
                    recommendReason: rec.recommendReason || null,
                    strengthMatch: rec.strengthMatch || [],
                    skillGap: rec.skillGap || [],
                    growthAdvice: rec.growthAdvice || null,
                  },
                }).catch(() => {})
              }
            }
          } catch { /* 推荐记录保存失败不影响主流程 */ }
        }
      }

      return {
        reply: result.reply,
        profile: result.profile,
        isComplete: result.isComplete,
        stage: result.stage,
        recommendations,
        careerAdvice: result.careerAdvice || null,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '处理失败', detail: e.message })
    }
  })

  // ─── 获取欢迎消息 ───

  fastify.get('/api/job/welcome', async (request) => {
    const userId = (request.query as any)?.userId as string
    const engine = interviewSessions.get(userId || 'anonymous')

    if (engine) {
      return { welcome: engine.getWelcomeMessage() }
    }

    // 检查是否有历史画像
    if (userId && userId !== 'anonymous') {
      const saved = await prisma.careerProfile.findFirst({ where: { userId } }).catch(() => null)
      if (saved) {
        const profile = {
          name: saved.fullName || '',
          education: saved.educations?.[0]?.degree || saved.educations?.[0]?.field || '',
          skills: saved.skills?.map(s => s.name) || [],
          experience: saved.workExperiences?.[0]?.title || saved.headline || '',
          city: saved.city || '',
          salaryMin: 0,
          salaryMax: 0,
          careerGoal: saved.bio || '',
        }
        const newEngine = new JobCareerEngine(profile)
        interviewSessions.set(userId, newEngine)
        return { welcome: newEngine.getWelcomeMessage(), hasProfile: true }
      }
    }

    return { welcome: '你好！我是你的 AI 职业顾问 👋\n\n我会通过几个问题了解你的情况，帮你找到最合适的工作机会。\n\n先告诉我，你希望我怎么称呼你？', hasProfile: false }
  })

  // ─── 求职者画像 ───
  // NOTE: /api/job/profile (GET/PUT) 已迁移至 candidate-profile.routes.ts

  // ─── 推荐岗位 ───

  fastify.get('/api/job/recommendations', async (request, reply) => {
    const userId = (request.query as any)?.userId as string
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' })
    }
    // UUID 格式校验
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return reply.status(400).send({ error: 'userId 必须是有效 UUID 格式' })
    }

    try {
      const recommendations = await prisma.jobRecommendation.findMany({
        where: { candidateId: userId },
        include: { job: true },
        orderBy: { matchScore: 'desc' },
        take: 10,
      })
      return recommendations
    } catch (e: any) {
      return reply.status(500).send({ error: '查询失败', detail: e?.message || '未知错误' })
    }
  })

  // ─── 岗位管理 ───

  fastify.get('/api/job/postings', async (request) => {
    const { city, status, page = 1, limit = 20 } = request.query as any

    try {
      const where: any = {}
      if (city) where.location = { contains: city, mode: 'insensitive' }
      if (status) where.status = status
      else where.status = 'active'

      const [postings, total] = await Promise.all([
        prisma.jobPosting.findMany({
          where,
          include: { enterprise: true },
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        prisma.jobPosting.count({ where }),
      ])

      return { postings, total, page: Number(page), limit: Number(limit) }
    } catch (e) {
      return { postings: [], total: 0, page: 1, limit: 20 }
    }
  })

  fastify.post('/api/job/postings', async (request, reply) => {
    // Sprint-02 Fix: JWT 认证
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const userId = (request.user as any)?.id || (request.user as any)?.userId
    if (!userId) {
      return reply.status(401).send({ error: '用户未认证' })
    }

    // Sprint-02 Fix: 从 JWT 解析 enterpriseId
    const enterpriseId = await resolveEnterpriseId(userId)
    if (!enterpriseId) {
      return reply.status(404).send({ error: '未找到企业身份，请先完成企业创建' })
    }

    const body = request.body as {
      title: string
      salary?: string
      location?: string
      description?: string
      requirements?: string
    }

    if (!body.title) {
      return reply.status(400).send({ error: 'title is required' })
    }

    try {
      const posting = await prisma.jobPosting.create({
        data: {
          enterpriseId,
          title: body.title,
          salary: body.salary,
          location: body.location,
          description: body.description,
          requirements: body.requirements,
          status: 'active',
        },
      })
      return posting
    } catch (e) {
      return reply.status(500).send({ error: '发布失败' })
    }
  })

  // ─── 招聘动态 ───

  fastify.get('/api/job/news', async (request) => {
    const { category, page = 1, limit = 10 } = request.query as any

    try {
      const where: any = {}
      if (category) where.category = category

      const [news, total] = await Promise.all([
        prisma.jobNews.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        prisma.jobNews.count({ where }),
      ])

      return { news, total, page: Number(page), limit: Number(limit) }
    } catch (e) {
      return { news: [], total: 0, page: 1, limit: 10 }
    }
  })

  // ─── 招聘统计 ───

  fastify.get('/api/job/statistics', async () => {
    try {
      const [totalPostings, totalCandidates, totalCompanies] = await Promise.all([
        prisma.jobPosting.count({ where: { status: 'active' } }),
        prisma.careerProfile.count(),
        prisma.jobCompanyProfile.count(),
      ])

      return {
        totalNewJobs: totalPostings,
        totalCandidates,
        totalCompanies,
        cityDistribution: {},
        industryDistribution: {},
        topPositions: [],
      }
    } catch (e) {
      return {
        totalNewJobs: 0,
        totalCandidates: 0,
        totalCompanies: 0,
        cityDistribution: {},
        industryDistribution: {},
        topPositions: [],
      }
    }
  })

  // ─── Phase 1.6: 岗位行为反馈 ───

  fastify.post('/api/job/recommendations/feedback', async (request, reply) => {
    const body = request.body as {
      userId: string
      jobId: string
      feedback: 'favorite' | 'not_interested' | 'applied' | 'interviewed'
    }

    if (!body.userId || !body.jobId || !body.feedback) {
      return reply.status(400).send({ error: 'userId, jobId, feedback 都是必填' })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(body.userId)) {
      return reply.status(400).send({ error: 'userId 必须是有效 UUID' })
    }

    try {
      // 获取 candidate — Sprint-SSOT-CLEANUP-01: JobCandidate → CareerProfile
      const candidate = await prisma.careerProfile.findFirst({ where: { userId: body.userId } })
      if (!candidate) {
        return reply.status(404).send({ error: '未找到求职者画像' })
      }

      // 更新推荐记录
      const updated = await prisma.jobRecommendation.updateMany({
        where: {
          candidateId: candidate.id,
          jobId: body.jobId,
        },
        data: {
          feedback: body.feedback,
          feedbackAt: new Date(),
        },
      })

      if (updated.count === 0) {
        // 如果没有推荐记录，创建一条
        await prisma.jobRecommendation.create({
          data: {
            candidateId: candidate.id,
            jobId: body.jobId,
            matchScore: 0,
            reason: '用户反馈',
            status: 'pending',
            feedback: body.feedback,
            feedbackAt: new Date(),
          },
        })
      }

      return { success: true, message: '反馈已记录' }
    } catch (e: any) {
      return reply.status(500).send({ error: '反馈失败', detail: e.message })
    }
  })

  // ─── Phase 1.6: 个人职业档案中心 ───

  fastify.get('/api/job/profile/center', async (request, reply) => {
    const userId = (request.query as any)?.userId as string
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return reply.status(400).send({ error: 'userId 必须是有效 UUID' })
    }

    try {
      const candidate = await prisma.careerProfile.findFirst({
        where: { userId },
        include: {
          user: {
            include: {
              candidateOnCareerProfile: {
                include: {
                  recommendations: {
                    include: { job: true },
                    orderBy: { matchScore: 'desc' },
                    take: 10,
                  },
                },
              },
            },
          },
        },
      })

      if (!candidate) {
        return { hasProfile: false }
      }

      // 统计反馈
      const feedbackStats = {
        favorite: candidate.recommendations.filter(r => r.feedback === 'favorite').length,
        notInterested: candidate.recommendations.filter(r => r.feedback === 'not_interested').length,
        applied: candidate.recommendations.filter(r => r.feedback === 'applied').length,
        interviewed: candidate.recommendations.filter(r => r.feedback === 'interviewed').length,
      }

      // 收藏列表
      const favorites = candidate.recommendations
        .filter(r => r.feedback === 'favorite')
        .map(r => ({
          jobId: r.jobId,
          title: r.job?.title || '',
          company: r.job?.enterprise?.businessSummary || '',
          matchScore: r.matchScore,
          salary: r.job?.salary || '',
          location: r.job?.location || '',
        }))

      return {
        hasProfile: true,
        profile: {
          name: candidate.profileJson?.name || '',
          education: candidate.education || '',
          skills: candidate.skills || [],
          experience: candidate.experience || '',
          city: candidate.city || '',
          salaryMin: candidate.profileJson?.salaryMin || 0,
          salaryMax: candidate.profileJson?.salaryMax || 0,
          careerGoal: candidate.careerGoal || '',
          completeness: candidate.profileJson?.completeness || 0,
        },
        feedbackStats,
        favorites,
        totalRecommendations: candidate.recommendations.length,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '查询失败', detail: e.message })
    }
  })

  // ─── 简历分析（企业）───

  fastify.post('/api/job/resume/analyze', async (_request, reply) => {
    return reply.status(501).send({ message: '简历分析功能将在 Phase 2 接入' })
  })

  // ─── 面试助手（企业）───

  fastify.post('/api/job/interview/generate', async (_request, reply) => {
    return reply.status(501).send({ message: '面试助手功能将在 Phase 2 接入' })
  })
}
