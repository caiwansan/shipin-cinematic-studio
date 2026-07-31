/**
 * job-posting.routes.ts — Job Posting CRUD API
 * Sprint-05B: Job Posting Reality Layer
 *
 * Sprint-Enterprise-Identity-Hardening-01 Phase 3:
 * 使用 EnterpriseContextService 统一解析企业身份。
 *
 * Tenant isolation: auto-resolve enterprise from JWT → identity context
 * All routes require JWT authentication
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { resolveEnterpriseId } from '../services/enterprise-context.service.js'
import { requireEnterpriseCapability } from '../middleware/require-enterprise-capability.js'

// ─── Helper: resolve workspaceId → enterpriseId (legacy) ───
async function resolveEnterpriseIdFromWorkspace(workspaceId?: string): Promise<string | null> {
  if (!workspaceId) return null
  const workspace = await prisma.enterpriseJobWorkspace.findUnique({
    where: { id: workspaceId },
    select: { enterpriseId: true },
  })
  return workspace?.enterpriseId || null
}

// ─── Helper: get workspaceId from enterpriseId ───
async function resolveWorkspaceId(enterpriseId: string): Promise<string | null> {
  const workspace = await prisma.enterpriseJobWorkspace.findUnique({
    where: { enterpriseId },
    select: { id: true },
  })
  return workspace?.id || null
}

export const jobPostingRoutes = async (fastify: FastifyInstance) => {

  // ─── JWT Auth for all routes ───
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ─── GET /api/enterprise/postings — 职位列表 ───
  fastify.get('/api/enterprise/postings', async (request, reply) => {
    try {
      const { workspaceId, status, keyword } = request.query as {
        workspaceId?: string
        status?: string
        keyword?: string
      }

      const userId = (request as any).user?.id || (request as any).userId
      let enterpriseId = await resolveEnterpriseIdFromWorkspace(workspaceId)
      if (!enterpriseId && userId) {
        enterpriseId = await resolveEnterpriseId(userId)
      }
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      const jobs = await prisma.jobPosting.findMany({
        where: {
          enterpriseId,
          ...(status ? { status } : {}),
          ...(keyword ? { title: { contains: keyword, mode: 'insensitive' as const } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      // Sprint 07 Week 3: 使用 groupBy 替代 N+1 查询获取候选人数量
      const jobIds = jobs.map(j => j.id)
      const candidateCounts = jobIds.length > 0
        ? await prisma.recruitmentPipeline.groupBy({
            by: ['jobId'],
            where: { jobId: { in: jobIds } },
            _count: { id: true },
          })
        : []
      const countMap = new Map(candidateCounts.map(c => [c.jobId, c._count.id]))

      const channelCounts = jobIds.length > 0
        ? await prisma.recruitmentChannelMapping.groupBy({
            by: ['jobId'],
            where: { jobId: { in: jobIds } },
            _count: { id: true },
          })
        : []
      const channelCountMap = new Map(channelCounts.map(c => [c.jobId, c._count.id]))

      const jobsWithCount = jobs.map(job => ({
        id: job.id,
        title: job.title,
        salary: job.salary,
        location: job.location,
        description: job.description,
        requirements: job.requirements,
        skillRequirements: job.skillRequirements,
        tags: job.tags,
        status: job.status,
        qualityScore: job.qualityScore,
        industry: job.industry,
        careerPath: job.careerPath,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        candidateCount: countMap.get(job.id) || 0,
        channelCount: channelCountMap.get(job.id) || 0,
      }))

      return reply.status(200).send({ success: true, data: jobsWithCount, total: jobsWithCount.length })
    } catch (error: any) {
      request.log.error(`[job-posting] list: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /api/enterprise/postings/:id — 职位详情 ───
  fastify.get('/api/enterprise/postings/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const userId = (request as any).user?.id || (request as any).userId
      const enterpriseId = await resolveEnterpriseId(userId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      const job = await prisma.jobPosting.findFirst({
        where: { id, enterpriseId },
      })

      if (!job) return reply.status(404).send({ error: 'Job not found' })

      // 获取关联数据
      const [candidateCount, recentCandidates, channelMappings] = await Promise.all([
        prisma.recruitmentPipeline.count({ where: { jobId: id } }),
        prisma.recruitmentPipeline.findMany({
          where: { jobId: id },
          orderBy: { lastActivityAt: 'desc' },
          take: 5,
          select: {
            id: true,
            candidateName: true,
            stage: true,
            screeningScore: true,
          },
        }),
        prisma.recruitmentChannelMapping.findMany({
          where: { jobId: id },
          include: {
            channel: { select: { id: true, name: true, type: true } },
          },
        }),
      ])

      return reply.status(200).send({
        success: true,
        data: {
          id: job.id,
          title: job.title,
          salary: job.salary,
          location: job.location,
          description: job.description,
          requirements: job.requirements,
          skillRequirements: job.skillRequirements,
          tags: job.tags,
          status: job.status,
          qualityScore: job.qualityScore,
          industry: job.industry,
          careerPath: job.careerPath,
          promotionPath: job.promotionPath,
          relatedSkills: job.relatedSkills,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          candidateCount,
          recentCandidates,
          channelCount: channelMappings.length,
          channels: channelMappings.map(m => ({
            id: m.id,
            channelId: m.channelId,
            channel: m.channel,
            status: m.status,
            channelJobId: m.channelJobId,
            createdAt: m.createdAt,
          })),
        },
      })
    } catch (error: any) {
      request.log.error(`[job-posting] detail: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /api/enterprise/channels — 可用的招聘发布渠道 ───
  fastify.get('/api/enterprise/channels', async (request, reply) => {
    try {
      const channels = await prisma.recruitmentChannel.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
        },
      })
      return reply.send({ success: true, data: channels })
    } catch (error: any) {
      request.log.error(`[job-posting] channels: ${error.message}`)
      return reply.send({ success: true, data: [] })
    }
  })

  // ─── POST /api/enterprise/postings/:id/channels — 发布职位到渠道 ───
  fastify.post('/api/enterprise/postings/:id/channels', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { channelIds } = request.body as { channelIds: string[] }

      const userId = (request as any).user?.id || (request as any).userId
      const enterpriseId = await resolveEnterpriseId(userId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      const job = await prisma.jobPosting.findFirst({
        where: { id, enterpriseId },
      })
      if (!job) return reply.status(404).send({ error: 'Job not found' })

      if (!channelIds?.length) {
        return reply.status(400).send({ error: 'channelIds is required' })
      }

      // 批量创建映射（无复合唯一约束，逐条查询+upsert）
      const mappings = []
      for (const channelId of channelIds) {
        const existing = await prisma.recruitmentChannelMapping.findFirst({
          where: { jobId: id, channelId },
        })
        if (existing) {
          mappings.push(await prisma.recruitmentChannelMapping.update({
            where: { id: existing.id },
            data: { status: 'published' },
          }))
        } else {
          mappings.push(await prisma.recruitmentChannelMapping.create({
            data: { jobId: id, channelId, status: 'published' },
          }))
        }
      }

      return reply.send({ success: true, data: mappings })
    } catch (error: any) {
      request.log.error(`[job-posting] publish channels: ${error.message}`)
      return reply.status(500).send({ error: 'Publish failed', detail: error.message })
    }
  })

  // ─── GET /api/enterprise/candidates — 企业候选人列表（Capability Gate: CANDIDATE_SEARCH） ───
  fastify.get('/api/enterprise/candidates', { preHandler: requireEnterpriseCapability('CANDIDATE_SEARCH') }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      let enterpriseId = await resolveEnterpriseId(userId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      // 1. 获取该企业所有岗位ID
      const jobPostings = await prisma.jobPosting.findMany({
        where: { enterpriseId },
        select: { id: true, title: true },
      })
      const jobIds = jobPostings.map(j => j.id)

      if (jobIds.length === 0) {
        return reply.send({ success: true, candidates: [], total: 0 })
      }

      // 2. 获取所有匹配记录（按 matchScore 降序）
      // ⚠️ candidate 关系已在 schema 中注释（待 Identity Consolidation），不能 include
      const matches = await prisma.candidateMatch.findMany({
        where: { jobId: { in: jobIds } },
        orderBy: { matchScore: 'desc' },
        include: {
          job: {
            select: { id: true, title: true },
          },
        },
      })

      // 3. 从 CareerProfile 独立查询候选人信息
      const candidateIds = [...new Set(matches.map(m => m.candidateId).filter(Boolean))]
      const profiles = candidateIds.length > 0
        ? await prisma.careerProfile.findMany({
            where: { id: { in: candidateIds } },
            select: {
              id: true,
              fullName: true,
              headline: true,
              city: true,
              bio: true,
              skills: { select: { name: true } },
              workExperiences: { take: 1, select: { title: true } },
              educations: { take: 1, select: { degree: true, field: true } },
            },
          })
        : []
      const profileMap = new Map(profiles.map(p => [p.id, p]))

      // 4. 聚合同一候选人的最高匹配分
      const candidateMap = new Map<string, any>()
      for (const m of matches) {
        const profile = profileMap.get(m.candidateId)
        const cid = m.candidateId
        const existing = candidateMap.get(cid)
        if (!existing || m.matchScore > existing.matchScore) {
          candidateMap.set(cid, {
            id: cid,
            fullName: profile?.fullName || '候选人',
            education: profile?.educations?.[0]?.degree || profile?.educations?.[0]?.field || null,
            skills: profile?.skills?.map(s => s.name) || [],
            experience: profile?.headline || profile?.workExperiences?.[0]?.title || '',
            city: profile?.city || '',
            bio: profile?.bio || '',
            matchScore: m.matchScore,
            matchBreakdown: m.matchBreakdown,
            aiAnalysis: m.aiAnalysis,
            matchId: m.id,
            jobId: m.job.id,
            jobTitle: m.job.title,
            matchStatus: m.status,
            matchedAt: m.createdAt,
          })
        }
      }

      const allCandidates = Array.from(candidateMap.values())
      const total = allCandidates.length
      const { page = '1', pageSize = '20' } = request.query as { page?: string; pageSize?: string }
      const pageNum = Math.max(1, parseInt(page, 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
      const offset = (pageNum - 1) * limit
      const candidates = allCandidates.slice(offset, offset + limit)
      return reply.send({ success: true, candidates, total, page: pageNum, pageSize: limit })
    } catch (error: any) {
      request.log.error(`[job-posting] candidates: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to fetch candidates' })
    }
  })

  // ─── POST /api/enterprise/postings — 创建职位 ───
  fastify.post('/api/enterprise/postings', async (request, reply) => {
    try {
      const body = request.body as {
        workspaceId?: string
        enterpriseId?: string
        title: string
        description?: string
        requirements?: string
        salary?: string
        location?: string
        skillRequirements?: string[]
        tags?: string[]
        industry?: string
        careerPath?: string
        status?: string
      }

      if (!body.title) {
        return reply.status(400).send({ error: 'title is required' })
      }

      // Resolve enterpriseId from workspaceId, enterpriseId, or JWT user
      let enterpriseId = body.enterpriseId
      if (!enterpriseId && body.workspaceId) {
        enterpriseId = await resolveEnterpriseIdFromWorkspace(body.workspaceId) || undefined
      }
      if (!enterpriseId) {
        const userId = (request as any).user?.id || (request as any).userId
        if (userId) {
          enterpriseId = await resolveEnterpriseId(userId) || undefined
        }
      }
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      const job = await prisma.jobPosting.create({
        data: {
          enterpriseId,
          title: body.title,
          description: body.description || null,
          requirements: body.requirements || null,
          salary: body.salary || null,
          location: body.location || null,
          skillRequirements: body.skillRequirements || [],
          tags: body.tags || [],
          industry: body.industry || null,
          careerPath: body.careerPath || null,
          status: body.status || 'draft',
        },
      })

      return reply.status(201).send({ success: true, data: job })
    } catch (error: any) {
      request.log.error(`[job-posting] create: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to create job posting' })
    }
  })

  // ─── PUT /api/enterprise/postings/:id — 更新职位 ───
  fastify.put('/api/enterprise/postings/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { workspaceId } = request.query as { workspaceId?: string }
      const body = request.body as {
        title?: string
        description?: string
        requirements?: string
        salary?: string
        location?: string
        skillRequirements?: string[]
        tags?: string[]
        industry?: string
        careerPath?: string
        promotionPath?: string
        relatedSkills?: string[]
        status?: 'draft' | 'published' | 'paused' | 'closed'
      }

      // Status transition validation
      const VALID_TRANSITIONS: Record<string, string[]> = {
        draft: ['published'],
        published: ['paused', 'closed'],
        paused: ['published', 'closed'],
        closed: [],
      }

      const userId = (request as any).user?.id || (request as any).userId
      let enterpriseId = await resolveEnterpriseIdFromWorkspace(workspaceId)
      if (!enterpriseId && userId) {
        enterpriseId = await resolveEnterpriseId(userId)
      }
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      // Verify ownership
      const existing = await prisma.jobPosting.findFirst({
        where: { id, enterpriseId },
      })
      if (!existing) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      // Validate status transition
      if (body.status && body.status !== existing.status) {
        const allowed = VALID_TRANSITIONS[existing.status] || []
        if (!allowed.includes(body.status)) {
          return reply.status(400).send({
            error: `Invalid status transition: ${existing.status} → ${body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
          })
        }
      }

      const job = await prisma.jobPosting.update({
        where: { id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.requirements !== undefined ? { requirements: body.requirements } : {}),
          ...(body.salary !== undefined ? { salary: body.salary } : {}),
          ...(body.location !== undefined ? { location: body.location } : {}),
          ...(body.skillRequirements !== undefined ? { skillRequirements: body.skillRequirements } : {}),
          ...(body.tags !== undefined ? { tags: body.tags } : {}),
          ...(body.industry !== undefined ? { industry: body.industry } : {}),
          ...(body.careerPath !== undefined ? { careerPath: body.careerPath } : {}),
          ...(body.promotionPath !== undefined ? { promotionPath: body.promotionPath } : {}),
          ...(body.relatedSkills !== undefined ? { relatedSkills: body.relatedSkills } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
      })

      return reply.status(200).send({ success: true, data: job })
    } catch (error: any) {
      request.log.error(`[job-posting] update: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to update job posting' })
    }
  })

  // ─── PATCH /api/enterprise/postings/:id/status — 状态变更 ───
  fastify.patch('/api/enterprise/postings/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { workspaceId } = request.query as { workspaceId?: string }
      const { status } = request.body as { status: string }

      const VALID_STATUSES = ['draft', 'published', 'paused', 'closed']
      if (!VALID_STATUSES.includes(status)) {
        return reply.status(400).send({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` })
      }

      const userId = (request as any).user?.id || (request as any).userId
      let enterpriseId = await resolveEnterpriseIdFromWorkspace(workspaceId)
      if (!enterpriseId && userId) {
        enterpriseId = await resolveEnterpriseId(userId)
      }
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      // Verify ownership
      const existing = await prisma.jobPosting.findFirst({
        where: { id, enterpriseId },
      })
      if (!existing) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const job = await prisma.jobPosting.update({
        where: { id },
        data: { status },
      })

      return reply.status(200).send({ success: true, data: job })
    } catch (error: any) {
      request.log.error(`[job-posting] status: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to update status' })
    }
  })

  // ─── DELETE /api/enterprise/postings/:id — 删除职位 ───
  fastify.delete('/api/enterprise/postings/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const { workspaceId } = request.query as { workspaceId?: string }

      const userId = (request as any).user?.id || (request as any).userId
      let enterpriseId = await resolveEnterpriseIdFromWorkspace(workspaceId)
      if (!enterpriseId && userId) {
        enterpriseId = await resolveEnterpriseId(userId)
      }
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'No enterprise identity found' })
      }

      // Verify ownership
      const existing = await prisma.jobPosting.findFirst({
        where: { id, enterpriseId },
      })
      if (!existing) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      // Check for active candidates
      const activeCandidates = await prisma.recruitmentPipeline.count({
        where: { jobId: id, stage: { in: ['screening', 'interview', 'offer'] } },
      })

      if (activeCandidates > 0) {
        return reply.status(409).send({
          error: 'Cannot delete job with active candidates',
          activeCandidates,
        })
      }

      await prisma.jobPosting.delete({ where: { id } })

      return reply.status(200).send({ success: true, message: 'Job deleted' })
    } catch (error: any) {
      request.log.error(`[job-posting] delete: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to delete job posting' })
    }
  })
}
