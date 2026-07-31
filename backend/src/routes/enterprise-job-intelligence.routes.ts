/**
 * enterprise-job-intelligence.routes.ts
 * Sprint-06: AI Job Intelligence Layer
 *
 * AI-powered JD generation, talent matching, and agent-driven recruitment actions.
 * All routes use new identity system (JWT → userId → EnterpriseProfile).
 * No fallback to old /api/job/match/* endpoints.
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { jobUnderstandingService, JobUnderstandingError } from '../services/matching/services/job-understanding.service.js'
import { resolveCurrentEnterprise } from '../services/enterprise-context.service.js'
import { requireEnterpriseCapability } from '../middleware/require-enterprise-capability.js'

export const enterpriseJobIntelligenceRoutes = async (fastify: FastifyInstance) => {

  // ─── JWT Auth for all routes ───
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // Sprint-06A: AI JD Generator
  // ═══════════════════════════════════════════════════════════════

  // ─── POST /api/enterprise/jobs/generate — AI 生成 JD ───
  fastify.post('/api/enterprise/jobs/generate', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const context = await resolveCurrentEnterprise(userId)
      if (!context) {
        return reply.status(403).send({ success: false, message: 'Enterprise context required' })
      }
      const enterpriseId = context.enterpriseId

      const body = request.body as {
        title?: string
        description?: string
        skills?: string[]
        location?: string
        salaryMin?: number
        salaryMax?: number
        employmentType?: string
        department?: string
        language?: string
      }

      // Use LLM to extract structured requirements
      const result = await jobUnderstandingService.extractAndSave({
        enterpriseId,
        jobTitle: body.title || '',
        jobDescription: body.description || '',
        department: body.department,
        location: body.location,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        employmentType: body.employmentType,
        language: body.language || 'zh',
      })

      return reply.status(201).send({ success: true, data: result })
    } catch (error: any) {
      if (error instanceof JobUnderstandingError) {
        return reply.status(error.statusCode).send({ error: error.message })
      }
      request.log.error(`[job-intelligence] generate: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to generate JD' })
    }
  })

  // ─── POST /api/enterprise/jobs/preview — AI 预览（不保存） ───
  fastify.post('/api/enterprise/jobs/preview', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const context = await resolveCurrentEnterprise(userId)
      if (!context) {
        return reply.status(403).send({ success: false, message: 'Enterprise context required' })
      }
      const enterpriseId = context.enterpriseId

      const body = request.body as {
        title?: string
        description?: string
        language?: string
      }

      const result = await jobUnderstandingService.extractOnly({
        enterpriseId,
        jobTitle: body.title || '',
        jobDescription: body.description || '',
        language: body.language || 'zh',
      })

      return reply.status(200).send({ success: true, data: result })
    } catch (error: any) {
      if (error instanceof JobUnderstandingError) {
        return reply.status(error.statusCode).send({ error: error.message })
      }
      request.log.error(`[job-intelligence] preview: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to preview JD' })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // Sprint-06B: Talent Matching Reality
  // ═══════════════════════════════════════════════════════════════

  // ─── GET /api/enterprise/jobs/:id/matches ─ 获取匹配结果 ───
  fastify.get('/api/enterprise/jobs/:id/matches', async (request, reply) => {
    try {
      const { id: jobId } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const context = await resolveCurrentEnterprise(userId)
      if (!context) {
        return reply.status(403).send({ success: false, message: 'Enterprise context required' })
      }
      const enterpriseId = context.enterpriseId

      // Verify job ownership
      const job = await prisma.jobPosting.findFirst({
        where: { id: jobId, enterpriseId },
      })
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      // Get match results from DB
      const matches = await prisma.talentMatchResult.findMany({
        where: {
          jobRequirementId: {
            in: (
              await prisma.jobRequirementProfile.findMany({
                where: { enterpriseId },
                select: { id: true },
              })
            ).map((r) => r.id),
          },
        },
        orderBy: { score: 'desc' },
        take: 20,
      })

      // Get candidate details — Sprint-SSOT-CLEANUP-01: JobCandidate → CareerProfile
      const candidateIds = matches.map((m) => m.candidateId)
      const candidates = await prisma.careerProfile.findMany({
        where: { id: { in: candidateIds } },
        select: {
          id: true,
          fullName: true,
          email: true,
          headline: true,
          userId: true,
        },
      })

      const candidateMap = new Map(candidates.map((c) => [c.id, c]))

      const enriched = matches.map((m) => {
        const candidate = candidateMap.get(m.candidateId)
        return {
          id: m.id,
          candidateId: m.candidateId,
          candidateName: candidate?.fullName || candidate?.email || '未知候选人',
          candidateTitle: candidate?.headline || '',
          score: m.score,
          rank: m.rank,
          breakdown: m.breakdown,
          matchedSkills: m.matchedSkills,
          missingSkills: m.missingSkills,
          riskFlags: m.riskFlags,
          reasoning: m.reasoning,
          recommendation: m.score >= 80 ? '推荐面试' : m.score >= 60 ? '值得了解' : '暂不匹配',
        }
      })

      return reply.status(200).send({
        success: true,
        data: enriched,
        total: enriched.length,
        jobId,
        jobTitle: job.title,
      })
    } catch (error: any) {
      request.log.error(`[job-intelligence] matches: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to fetch matches' })
    }
  })

  // ─── POST /api/enterprise/jobs/:id/match ─ 执行匹配（Capability Gate: AI_RESUME_MATCH） ───
  fastify.post('/api/enterprise/jobs/:id/match', { preHandler: requireEnterpriseCapability('AI_RESUME_MATCH') }, async (request, reply) => {
    try {
      const { id: jobId } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const context = await resolveCurrentEnterprise(userId)
      if (!context) {
        return reply.status(403).send({ success: false, message: 'Enterprise context required' })
      }
      const enterpriseId = context.enterpriseId

      // Verify job ownership
      const job = await prisma.jobPosting.findFirst({
        where: { id: jobId, enterpriseId },
      })
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      // Find or create JobRequirementProfile for this job
      let requirement = await prisma.jobRequirementProfile.findFirst({
        where: { enterpriseId, jobTitle: job.title },
      })

      if (!requirement) {
        // Auto-generate requirement from job posting using LLM
        const extracted = await jobUnderstandingService.extractAndSave({
          enterpriseId,
          jobTitle: job.title,
          jobDescription: job.description || job.title,
          location: job.location || undefined,
          salaryMin: job.salary ? parseInt(job.salary) || undefined : undefined,
          salaryMax: job.salary ? parseInt(job.salary) || undefined : undefined,
          language: 'zh',
        })
        requirement = await prisma.jobRequirementProfile.findFirst({
          where: { enterpriseId, jobTitle: job.title },
        })
      }

      if (!requirement) {
        return reply.status(500).send({ error: 'Failed to create job requirement profile' })
      }

      // Get all candidates — Sprint-SSOT-CLEANUP-01: JobCandidate → CareerProfile
      // CareerProfile is SSOT; CandidateSkill is in relation table
      const candidates = await prisma.careerProfile.findMany({
        select: {
          id: true,
          fullName: true,
          email: true,
          headline: true,
          skills: {
            select: { name: true },
          },
          userId: true,
        },
      })

      if (candidates.length === 0) {
        return reply.status(200).send({
          success: true,
          data: [],
          total: 0,
          message: '暂无候选人数据，请先添加候选人',
        })
      }

      // Calculate match scores
      const requiredSkills = (requirement.requiredSkills as any[]) || []
      const results = candidates.map((candidate) => {
        const candidateSkills = (candidate.skills || []).map((s: any) => {
          if (typeof s === 'string') return s.toLowerCase()
          if (s?.name) return s.name.toLowerCase()
          return (s.name || s.skillName || '').toLowerCase()
        })
        const matched = requiredSkills.filter((s: any) => {
          const sName = (typeof s === 'string' ? s : (s.name || s.skillName || '')).toLowerCase()
          return candidateSkills.some((cs: string) => cs.includes(sName) || sName.includes(cs))
        })
        const missing = requiredSkills.filter((s: any) => {
          const sName = (typeof s === 'string' ? s : (s.name || s.skillName || '')).toLowerCase()
          return !candidateSkills.some((cs: string) => cs.includes(sName) || sName.includes(cs))
        })

        const score = requiredSkills.length > 0
          ? Math.round((matched.length / requiredSkills.length) * 100)
          : 50

        return {
          candidateId: candidate.id,
          candidateName: candidate.user?.username || candidate.user?.email || '未知候选人',
          candidateTitle: candidate.experience || '',
          score,
          matchedSkills: matched,
          missingSkills: missing,
          skillGap: missing.map((s: any) => ({ skill: typeof s === 'string' ? s : (s.name || s.skillName || ''), level: 'required' })),
          riskFlags: [],
          reasoning: score >= 80 ? '高度匹配' : score >= 60 ? '部分匹配' : '匹配度较低',
          recommendation: score >= 80 ? '推荐面试' : score >= 60 ? '值得了解' : '暂不匹配',
        }
      })

      // Sort by score descending
      results.sort((a, b) => b.score - a.score)

      return reply.status(200).send({
        success: true,
        data: results,
        total: results.length,
        jobId,
        jobTitle: job.title,
        requirementId: requirement.id,
      })
    } catch (error: any) {
      request.log.error(`[job-intelligence] match: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to match candidates' })
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // Sprint-06C: Agent 接入点（预留，后续 Sprint 实现完整 Agent 调用）
  // ═══════════════════════════════════════════════════════════════

  // ─── GET /api/enterprise/jobs/:id/insights ─ AI 招聘经理分析 ───
  fastify.get('/api/enterprise/jobs/:id/insights', async (request, reply) => {
    try {
      const { id: jobId } = request.params as { id: string }
      const userId = (request as any).user?.id || (request as any).userId
      const context = await resolveCurrentEnterprise(userId)
      if (!context) {
        return reply.status(403).send({ success: false, message: 'Enterprise context required' })
      }
      const enterpriseId = context.enterpriseId

      // Verify job ownership
      const job = await prisma.jobPosting.findFirst({
        where: { id: jobId, enterpriseId },
      })
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      // Get job stats
      // Note: JobCandidate has userId (not enterpriseId), so we count via CandidateMatch
      const [pipelineCount, matchCount] = await Promise.all([
        prisma.recruitmentPipeline.count({ where: { jobId } }),
        prisma.candidateMatch.count({ where: { jobId } }),
      ])

      // Get candidate count from matches
      const candidateMatchCount = await prisma.candidateMatch.count({ where: { jobId } })

      return reply.status(200).send({
        success: true,
        data: {
          jobId: job.id,
          jobTitle: job.title,
          status: job.status,
          stats: {
            pipelineCount,
            matchCount: candidateMatchCount,
          },
          insights: {
            summary: `岗位「${job.title}」当前有 ${candidateMatchCount} 条候选人匹配，${pipelineCount} 条 Pipeline 记录。`,
            recommendations: candidateMatchCount === 0
              ? ['暂无候选人匹配，可执行 AI 匹配分析', '可使用 AI 生成 JD 优化岗位要求']
              : ['候选人数据充足，可执行匹配分析', '建议关注高匹配度候选人'],
            risks: pipelineCount === 0 && candidateMatchCount > 0
              ? ['有候选人但无 Pipeline，建议启动招聘流程']
              : [],
          },
        },
      })
    } catch (error: any) {
      request.log.error(`[job-intelligence] insights: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to get insights' })
    }
  })
}
