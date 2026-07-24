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
import { prisma } from '../utils/index.js'
import { JobCareerEngine, CandidateProfile } from '../agents/job/job-career-engine.js'
import { matchJobs, generateMockJobs } from '../agents/job/job-matching.service.js'

// ─── 内存中的访谈状态（Phase 1 简化版，Phase 2 改为 Redis）───
const interviewSessions = new Map<string, JobCareerEngine>()

export default async function jobRoutes(fastify: FastifyInstance) {

  // 503: Job Posting 关系尚未完成同步
  fastify.addHook('onRequest', async (_request, reply) => {
    return reply.status(503).send({ error: 'Job Posting module is under maintenance', module: 'job-posting', status: 'maintenance' })
  })

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
          const saved = await prisma.jobCandidate.findUnique({
            where: { userId },
          })
          if (saved) {
            existingProfile = {
              name: saved.profileJson?.name || '',
              education: saved.education || '',
              skills: saved.skills || [],
              experience: saved.experience || '',
              city: saved.city || '',
              salaryMin: saved.profileJson?.salaryMin || 0,
              salaryMax: saved.profileJson?.salaryMax || 0,
              careerGoal: saved.careerGoal || '',
            }
          }
        }
        engine = new JobCareerEngine(existingProfile)
        interviewSessions.set(userId, engine)
      }

      // 处理消息
      const result = engine.processMessage(body.message)

      // 持久化到数据库（Phase 1 简化版）
      if (userId !== 'anonymous' && result.profile) {
        await prisma.jobCandidate.upsert({
          where: { userId },
          update: {
            education: result.profile.education || '',
            skills: result.profile.skills || [],
            experience: result.profile.experience || '',
            city: result.profile.city || '',
            salaryExpectation: result.profile.salaryMin ? `${result.profile.salaryMin}-${result.profile.salaryMax}K` : '',
            careerGoal: result.profile.careerGoal || '',
            profileJson: {
              name: result.profile.name,
              major: result.profile.major,
              experienceYears: result.profile.experienceYears,
              salaryMin: result.profile.salaryMin,
              salaryMax: result.profile.salaryMax,
              completeness: result.profile.completeness,
            },
          },
          create: {
            userId,
            education: result.profile.education || '',
            skills: result.profile.skills || [],
            experience: result.profile.experience || '',
            city: result.profile.city || '',
            salaryExpectation: result.profile.salaryMin ? `${result.profile.salaryMin}-${result.profile.salaryMax}K` : '',
            careerGoal: result.profile.careerGoal || '',
            profileJson: {
              name: result.profile.name,
              major: result.profile.major,
              experienceYears: result.profile.experienceYears,
              salaryMin: result.profile.salaryMin,
              salaryMax: result.profile.salaryMax,
              completeness: result.profile.completeness,
            },
          },
        })
      }

      // 如果访谈完成，生成推荐
      let recommendations: any[] = []
      if (result.isComplete && result.profile) {
        // 从数据库获取真实岗位，如果没有则用模拟数据
        const dbJobs = await prisma.jobPosting.findMany({
          where: { status: 'active' },
          include: {
            enterprise: {
              include: {
                enterprise: {
                  include: { organization: true }
                }
              }
            }
          },
          take: 20,
        })

        const jobPosts = dbJobs.length > 0
          ? dbJobs.map(j => ({
              id: j.id,
              title: j.title,
              company: j.enterprise?.enterprise?.organization?.name || j.enterprise?.businessSummary || '未知企业',
              salary: j.salary || '',
              location: j.location || '',
              description: j.description || '',
              requirements: j.requirements || '',
              qualityScore: j.qualityScore || 50,
            }))
          : generateMockJobs()

        recommendations = matchJobs(result.profile, jobPosts)

        // 保存推荐记录（Phase 1.5: 包含推荐解释增强字段）
        if (userId !== 'anonymous') {
          // 获取 jobCandidate 记录
          const candidate = await prisma.jobCandidate.findUnique({ where: { userId } })
          if (candidate) {
            for (const rec of recommendations.slice(0, 5)) {
              await prisma.jobRecommendation.create({
                data: {
                  candidateId: candidate.id,
                  jobId: rec.jobId,
                  matchScore: rec.matchScore,
                  reason: rec.reasons.join('；'),
                  status: 'pending',
                  // Phase 1.5: 推荐解释增强
                  recommendReason: rec.recommendReason || null,
                  strengthMatch: rec.strengthMatch || [],
                  skillGap: rec.skillGap || [],
                  growthAdvice: rec.growthAdvice || null,
                },
              }).catch(() => {}) // 忽略重复
            }
          }
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
      const saved = await prisma.jobCandidate.findUnique({ where: { userId } }).catch(() => null)
      if (saved) {
        const profile = {
          name: saved.profileJson?.name || '',
          education: saved.education || '',
          skills: saved.skills || [],
          experience: saved.experience || '',
          city: saved.city || '',
          salaryMin: saved.profileJson?.salaryMin || 0,
          salaryMax: saved.profileJson?.salaryMax || 0,
          careerGoal: saved.careerGoal || '',
        }
        const newEngine = new JobCareerEngine(profile)
        interviewSessions.set(userId, newEngine)
        return { welcome: newEngine.getWelcomeMessage(), hasProfile: true }
      }
    }

    return { welcome: '你好！我是你的 AI 职业顾问 👋\n\n我会通过几个问题了解你的情况，帮你找到最合适的工作机会。\n\n先告诉我，你希望我怎么称呼你？', hasProfile: false }
  })

  // ─── 求职者画像 ───

  fastify.get('/api/job/profile', async (request, reply) => {
    const userId = (request.query as any)?.userId as string
    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' })
    }

    try {
      const profile = await prisma.jobCandidate.findUnique({
        where: { userId },
      })
      return profile || { message: '未找到职业画像' }
    } catch (e: any) {
      return reply.status(500).send({ error: '查询失败', detail: e?.message || '未知错误' })
    }
  })

  fastify.put('/api/job/profile', async (request, reply) => {
    const body = request.body as {
      userId: string
      education?: string
      skills?: string[]
      experience?: string
      city?: string
      salaryExpectation?: string
      careerGoal?: string
      profileJson?: any
    }

    if (!body.userId) {
      return reply.status(400).send({ error: 'userId is required' })
    }

    try {
      const profile = await prisma.jobCandidate.upsert({
        where: { userId: body.userId },
        update: {
          education: body.education,
          skills: body.skills,
          experience: body.experience,
          city: body.city,
          salaryExpectation: body.salaryExpectation,
          careerGoal: body.careerGoal,
          profileJson: body.profileJson,
        },
        create: {
          userId: body.userId,
          education: body.education || '',
          skills: body.skills || [],
          experience: body.experience || '',
          city: body.city || '',
          salaryExpectation: body.salaryExpectation || '',
          careerGoal: body.careerGoal || '',
          profileJson: body.profileJson || {},
        },
      })
      return profile
    } catch (e) {
      return reply.status(500).send({ error: '保存失败' })
    }
  })

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
    const body = request.body as {
      enterpriseId: string
      title: string
      salary?: string
      location?: string
      description?: string
      requirements?: string
    }

    if (!body.enterpriseId || !body.title) {
      return reply.status(400).send({ error: 'enterpriseId and title are required' })
    }

    try {
      const posting = await prisma.jobPosting.create({
        data: {
          enterpriseId: body.enterpriseId,
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
        prisma.jobCandidate.count(),
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
      // 获取 candidate
      const candidate = await prisma.jobCandidate.findUnique({ where: { userId: body.userId } })
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
      const candidate = await prisma.jobCandidate.findUnique({
        where: { userId },
        include: {
          recommendations: {
            include: { job: true },
            orderBy: { matchScore: 'desc' },
            take: 10,
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
