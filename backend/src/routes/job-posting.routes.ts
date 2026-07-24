/**
 * job-posting.routes.ts — 企业职位发布管理 API
 * Sprint-07: 企业今天能够发布一个职位
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export async function jobPostingRoutes(fastify: FastifyInstance) {

  // 503: JobPosting 关系尚未完成同步
  fastify.addHook('onRequest', async (_request, reply) => {
    return reply.status(503).send({ error: 'Job Posting module is under maintenance', module: 'job-posting', status: 'maintenance' })
  })

  // ─── 职位列表（企业管理） ───
  fastify.get('/api/enterprise/postings', async (request, reply) => {
    const { workspaceId, enterpriseId, status, page = 1, limit = 20, keyword } = request.query as any

    if (!workspaceId && !enterpriseId) {
      return reply.status(400).send({ error: 'workspaceId 或 enterpriseId 是必填' })
    }

    try {
      let resolvedEnterpriseId = enterpriseId
      if (!resolvedEnterpriseId && workspaceId) {
        const workspace = await prisma.enterpriseJobWorkspace.findUnique({
          where: { id: workspaceId },
          select: { enterpriseId: true },
        })
        if (workspace) resolvedEnterpriseId = workspace.enterpriseId
      }

      const where: any = { enterpriseId: resolvedEnterpriseId }
      if (status) where.status = status
      if (keyword) {
        where.OR = [
          { title: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ]
      }

      const [postings, total] = await Promise.all([
        prisma.jobPosting.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          include: {
            _count: { select: { pipelines: true } },
            channels: { include: { channel: true } },
          },
        }),
        prisma.jobPosting.count({ where }),
      ])

      return {
        success: true,
        data: postings.map((p: any) => ({
          id: p.id,
          title: p.title,
          salary: p.salary,
          location: p.location,
          status: p.status,
          qualityScore: p.qualityScore,
          tags: p.tags,
          candidateCount: p._count?.pipelines || 0,
          channelCount: p.channels?.length || 0,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        total,
        page: Number(page),
        limit: Number(limit),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取职位列表失败', detail: e.message })
    }
  })

  // ─── 职位详情 ───
  fastify.get('/api/enterprise/postings/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }

    try {
      const job = await prisma.jobPosting.findUnique({
        where: { id: jobId },
        include: {
          _count: { select: { pipelines: true, interviews: true } },
          channels: { include: { channel: true } },
          pipelines: {
            where: { autoCreated: false },
            select: { id: true, candidateName: true, stage: true, screeningScore: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      })

      if (!job) return reply.status(404).send({ error: '职位不存在' })

      const jobData = job as any
      return {
        success: true,
        data: {
          id: jobData.id,
          title: jobData.title,
          salary: jobData.salary,
          location: jobData.location,
          description: jobData.description,
          requirements: jobData.requirements,
          status: jobData.status,
          qualityScore: jobData.qualityScore,
          tags: jobData.tags,
          skillRequirements: jobData.skillRequirements,
          industry: jobData.industry,
          careerPath: jobData.careerPath,
          promotionPath: jobData.promotionPath,
          relatedSkills: jobData.relatedSkills,
          candidateCount: jobData._count?.pipelines || 0,
          interviewCount: jobData._count?.interviews || 0,
          channels: jobData.channels || [],
          recentCandidates: jobData.pipelines || [],
          createdAt: jobData.createdAt,
          updatedAt: jobData.updatedAt,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取职位详情失败', detail: e.message })
    }
  })

  // ─── 更新职位信息 ───
  fastify.patch('/api/enterprise/postings/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const body = request.body as {
      title?: string
      description?: string
      requirements?: string
      salary?: string
      location?: string
      tags?: string[]
      skillRequirements?: string[]
      industry?: string
      careerPath?: string
      promotionPath?: string
      relatedSkills?: string[]
    }

    try {
      const job = await prisma.jobPosting.update({
        where: { id: jobId },
        data: {
          ...(body.title && { title: body.title }),
          ...(body.description && { description: body.description }),
          ...(body.requirements && { requirements: body.requirements }),
          ...(body.salary && { salary: body.salary }),
          ...(body.location && { location: body.location }),
          ...(body.tags && { tags: body.tags }),
          ...(body.skillRequirements && { skillRequirements: body.skillRequirements }),
          ...(body.industry && { industry: body.industry }),
          ...(body.careerPath && { careerPath: body.careerPath }),
          ...(body.promotionPath && { promotionPath: body.promotionPath }),
          ...(body.relatedSkills && { relatedSkills: body.relatedSkills }),
        },
      })

      return { success: true, data: { id: job.id, title: job.title } }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新失败', detail: e.message })
    }
  })

  // ─── 更新职位状态 ───
  fastify.patch('/api/enterprise/postings/:jobId/status', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const { status } = request.body as { status: string }

    const validStatuses = ['draft', 'published', 'paused', 'closed']
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: `无效状态，有效值: ${validStatuses.join(', ')}` })
    }

    try {
      const job = await prisma.jobPosting.update({
        where: { id: jobId },
        data: { status },
      })

      return { success: true, data: { id: job.id, status: job.status } }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新状态失败', detail: e.message })
    }
  })

  // ─── 删除职位 ───
  fastify.delete('/api/enterprise/postings/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }

    try {
      await prisma.jobPosting.delete({ where: { id: jobId } })
      return { success: true }
    } catch (e: any) {
      return reply.status(500).send({ error: '删除失败', detail: e.message })
    }
  })

  // ─── 招聘渠道列表 ───
  fastify.get('/api/enterprise/channels', async (_request, reply) => {
    try {
      const channels = await prisma.recruitmentChannel.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
      })

      return { success: true, data: channels }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取渠道列表失败', detail: e.message })
    }
  })

  // ─── 创建职位 ───
  fastify.post('/api/enterprise/postings', async (request, reply) => {
    const body = request.body as {
      enterpriseId?: string
      workspaceId?: string
      title: string
      description: string
      requirements?: string
      salary?: string
      location?: string
      tags?: string[]
      skillRequirements?: string[]
      industry?: string
      careerPath?: string
      promotionPath?: string
      relatedSkills?: string[]
      status?: string
    }

    if (!body.title || !body.description) {
      return reply.status(400).send({ error: 'title, description 都是必填' })
    }

    try {
      // Resolve enterpriseId: prefer direct enterpriseId, fallback to workspaceId lookup
      let enterpriseId = body.enterpriseId
      if (!enterpriseId && body.workspaceId) {
        const workspace = await prisma.enterpriseJobWorkspace.findUnique({
          where: { id: body.workspaceId },
          select: { enterpriseId: true },
        })
        if (workspace) enterpriseId = workspace.enterpriseId
      }

      if (!enterpriseId) {
        return reply.status(400).send({ error: '无法确定企业身份，请提供 enterpriseId 或 workspaceId' })
      }

      const posting = await prisma.jobPosting.create({
        data: {
          enterpriseId,
          title: body.title,
          description: body.description,
          requirements: body.requirements,
          salary: body.salary,
          location: body.location,
          tags: body.tags || [],
          skillRequirements: body.skillRequirements || [],
          industry: body.industry,
          careerPath: body.careerPath,
          promotionPath: body.promotionPath,
          relatedSkills: body.relatedSkills || [],
          qualityScore: 70,
          status: body.status || 'draft',
        },
      })

      return { success: true, data: { id: posting.id, title: posting.title } }
    } catch (e: any) {
      return reply.status(500).send({ error: '发布失败', detail: e.message })
    }
  })

  // ─── 发布职位到渠道 ───
  fastify.post('/api/enterprise/postings/:jobId/channels', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const { channelIds } = request.body as { channelIds: string[] }

    if (!channelIds?.length) {
      return reply.status(400).send({ error: '请选择至少一个渠道' })
    }

    try {
      // Verify job exists
      const job = await prisma.jobPosting.findUnique({ where: { id: jobId } })
      if (!job) return reply.status(404).send({ error: '职位不存在' })

      // Create mappings
      const mappings = await Promise.all(
        channelIds.map((channelId: string) =>
          prisma.recruitmentChannelMapping.upsert({
            where: { jobId_channelId: { jobId, channelId } },
            update: { status: 'published' },
            create: { jobId, channelId, status: 'published' },
          })
        )
      )

      return { success: true, data: mappings }
    } catch (e: any) {
      return reply.status(500).send({ error: '发布到渠道失败', detail: e.message })
    }
  })

  // ─── 从渠道下架 ───
  fastify.patch('/api/enterprise/postings/:jobId/channels/:channelId', async (request, reply) => {
    const { jobId, channelId } = request.params as { jobId: string; channelId: string }
    const { status } = request.body as { status: string }

    try {
      const mapping = await prisma.recruitmentChannelMapping.update({
        where: { jobId_channelId: { jobId, channelId } },
        data: { status },
      })

      return { success: true, data: mapping }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新渠道状态失败', detail: e.message })
    }
  })
}
