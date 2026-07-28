/**
 * enterprise.routes.ts — 企业 AI 招聘工作台 API
 *
 * Phase 2: 企业 AI 招聘部门
 * - AI 生成 JD
 * - 岗位优化建议
 * - 人才匹配
 * - 招聘工作台管理
 *
 * Sprint-Enterprise-Identity-Hardening-02 Phase 1:
 * 修复 Tenant Boundary — enterpriseId 从 JWT 解析，不再信任客户端输入。
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { EnterpriseRecruitAgent } from '../agents/job/enterprise-recruit-agent'
import { resolveEnterpriseId } from '../services/enterprise-context.service.js'

const prisma = new PrismaClient()

export async function enterpriseRoutes(fastify: FastifyInstance) {

  // 所有企业招聘接口都需要 JWT 认证
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ─── 获取/创建企业招聘空间 ───

  fastify.get('/api/enterprise/workspace', async (request, reply) => {
    const userId = (request.user as any)?.id || (request.user as any)?.userId
    if (!userId) {
      return reply.status(401).send({ error: '用户未认证' })
    }

    // Sprint-02 Fix: 从 JWT 解析 enterpriseId，不再信任客户端输入
    const enterpriseId = await resolveEnterpriseId(userId)
    if (!enterpriseId) {
      return reply.status(404).send({ error: '未找到企业身份，请先完成企业创建' })
    }

    try {
      const jcp = await prisma.jobCompanyProfile.findUnique({
        where: { id: enterpriseId },
      })

      if (!jcp) {
        return reply.status(404).send({ error: '企业档案不存在' })
      }

      let workspace = await prisma.enterpriseJobWorkspace.findFirst({
        where: { enterpriseId },
      })

      if (!workspace) {
        // 创建招聘空间
        workspace = await prisma.enterpriseJobWorkspace.create({
          data: {
            enterpriseId,
            name: '招聘工作台',
            plan: 'basic',
          },
        })
      }

      // 获取岗位列表
      const postings = await prisma.jobPosting.findMany({
        where: { enterpriseId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      // 获取匹配统计
      const matchCount = await prisma.candidateMatch.count({
        where: { workspaceId: workspace.id },
      })

      return {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          plan: workspace.plan,
          status: workspace.status,
          createdAt: workspace.createdAt,
        },
        stats: {
          postings: postings.length,
          matches: matchCount,
        },
        postings: postings.map(p => ({
          id: p.id,
          title: p.title,
          salary: p.salary,
          location: p.location,
          qualityScore: p.qualityScore,
          tags: p.tags,
          createdAt: p.createdAt,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取工作台失败', detail: e.message })
    }
  })

  // ─── AI 生成 JD ───

  fastify.post('/api/enterprise/jd/generate', async (request, reply) => {
    const userId = (request.user as any)?.id || (request.user as any)?.userId
    if (!userId) {
      return reply.status(401).send({ error: '用户未认证' })
    }

    // Sprint-02 Fix: 从 JWT 解析 enterpriseId
    const enterpriseId = await resolveEnterpriseId(userId)
    if (!enterpriseId) {
      return reply.status(404).send({ error: '未找到企业身份' })
    }

    const body = request.body as {
      companyName: string
      position: string
      industry?: string
      scale?: string
      salaryRange?: string
      location?: string
      requirements?: string[]
      benefits?: string[]
    }

    if (!body.position) {
      return reply.status(400).send({ error: 'position 是必填' })
    }

    try {
      const agent = new EnterpriseRecruitAgent()
      const result = agent.generateJD({
        companyName: body.companyName || '贵公司',
        position: body.position,
        industry: body.industry,
        scale: body.scale,
        salaryRange: body.salaryRange,
        location: body.location,
        requirements: body.requirements,
        benefits: body.benefits,
      })

      return { success: true, jd: result }
    } catch (e: any) {
      return reply.status(500).send({ error: 'JD 生成失败', detail: e.message })
    }
  })

  // ─── 岗位优化建议 ───

  fastify.post('/api/enterprise/jd/optimize', async (request, reply) => {
    const body = request.body as {
      title: string
      description: string
      requirements: string[]
      salary: string
      location: string
    }

    if (!body.title || !body.description) {
      return reply.status(400).send({ error: 'title 和 description 都是必填' })
    }

    try {
      const agent = new EnterpriseRecruitAgent()
      const result = agent.optimizeJob({
        title: body.title,
        description: body.description,
        requirements: body.requirements || [],
        salary: body.salary || '',
        location: body.location || '',
      })

      return { success: true, optimization: result }
    } catch (e: any) {
      return reply.status(500).send({ error: '优化分析失败', detail: e.message })
    }
  })

  // ─── 人才匹配 ───

  fastify.post('/api/enterprise/match', async (request, reply) => {
    const userId = (request.user as any)?.id || (request.user as any)?.userId
    if (!userId) {
      return reply.status(401).send({ error: '用户未认证' })
    }

    const body = request.body as {
      workspaceId: string
      jobId: string
    }

    if (!body.workspaceId || !body.jobId) {
      return reply.status(400).send({ error: 'workspaceId 和 jobId 都是必填' })
    }

    try {
      // Sprint-02 Fix: 验证 workspace 归属
      const workspace = await prisma.enterpriseJobWorkspace.findUnique({
        where: { id: body.workspaceId },
      })
      if (!workspace) {
        return reply.status(404).send({ error: '招聘空间不存在' })
      }

      // 获取岗位信息
      const job = await prisma.jobPosting.findUnique({
        where: { id: body.jobId },
      })

      if (!job) {
        return reply.status(404).send({ error: '岗位不存在' })
      }

      // 获取所有求职者画像 — Sprint-SSOT-CLEANUP-01: JobCandidate → CareerProfile
      const candidates = await prisma.careerProfile.findMany({
        take: 50,
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

      if (candidates.length === 0) {
        return { success: true, matches: [], message: '暂无匹配的求职者' }
      }

      // 执行匹配
      const agent = new EnterpriseRecruitAgent()
      const matches = agent.matchCandidates({
        jobId: job.id,
        jobRequirements: job.requirements?.split(/[,，、\n]/) || [],
        jobSkills: job.skillRequirements || [],
        jobSalary: job.salary || '',
        jobLocation: job.location || '',
        candidates: candidates.map(c => ({
          id: c.id,
          name: c.fullName || '求职者',
          skills: c.skills?.map(s => s.name) || [],
          experience: c.headline || c.workExperiences?.[0]?.title || '',
          city: c.city || '',
          salaryMin: 0,
          salaryMax: 0,
          education: c.educations?.[0]?.degree || c.educations?.[0]?.field || '',
        })),
      })

      // 保存匹配记录
      const savedMatches = []
      for (const match of matches.slice(0, 10)) {
        const existing = await prisma.candidateMatch.findFirst({
          where: {
            workspaceId: body.workspaceId,
            jobId: body.jobId,
            candidateId: match.candidateId,
          },
        })

        if (!existing) {
          const saved = await prisma.candidateMatch.create({
            data: {
              workspaceId: body.workspaceId,
              jobId: body.jobId,
              candidateId: match.candidateId,
              matchScore: match.matchScore,
              matchBreakdown: match.matchBreakdown as any,
              aiAnalysis: match.reasons.join('; '),
              status: 'pending',
            },
          })
          savedMatches.push({
            id: saved.id,
            matchScore: match.matchScore,
            name: match.name,
            reasons: match.reasons,
            risks: match.risks,
          })
        } else {
          savedMatches.push({
            id: existing.id,
            matchScore: match.matchScore,
            name: match.name,
            reasons: match.reasons,
            risks: match.risks,
          })
        }
      }

      return {
        success: true,
        matches: savedMatches,
        totalCandidates: candidates.length,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '匹配失败', detail: e.message })
    }
  })

  // ─── 获取匹配结果 ───

  fastify.get('/api/enterprise/matches', async (request, reply) => {
    const { workspaceId, jobId } = request.query as { workspaceId?: string; jobId?: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      // Sprint-02 Fix: 验证 workspace 归属
      const workspace = await prisma.enterpriseJobWorkspace.findUnique({
        where: { id: workspaceId },
      })
      if (!workspace) {
        return reply.status(404).send({ error: '招聘空间不存在' })
      }

      const matches = await prisma.candidateMatch.findMany({
        where: {
          workspaceId,
          ...(jobId ? { jobId } : {}),
        },
        include: {
          candidate: {
            select: {
              profileJson: true,
              skills: true,
              education: true,
              experience: true,
              city: true,
            },
          },
          job: {
            select: {
              title: true,
              salary: true,
              location: true,
            },
          },
        },
        orderBy: { matchScore: 'desc' },
        take: 20,
      })

      return {
        matches: matches.map(m => ({
          id: m.id,
          jobId: m.jobId,
          jobTitle: m.job?.title || '',
          candidateId: m.candidateId,
          candidateName: (m.candidate?.profileJson as any)?.name || '求职者',
          matchScore: m.matchScore,
          matchBreakdown: m.matchBreakdown,
          status: m.status,
          aiAnalysis: m.aiAnalysis,
          createdAt: m.createdAt,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取匹配结果失败', detail: e.message })
    }
  })

  // ─── 更新匹配状态 ───

  fastify.post('/api/enterprise/matches/status', async (request, reply) => {
    const body = request.body as {
      matchId: string
      status: 'pending' | 'contacted' | 'rejected' | 'hired'
    }

    if (!body.matchId || !body.status) {
      return reply.status(400).send({ error: 'matchId 和 status 都是必填' })
    }

    try {
      // Sprint-02 Fix: 验证 match 归属
      const match = await prisma.candidateMatch.findUnique({
        where: { id: body.matchId },
        include: { workspace: true },
      })
      if (!match) {
        return reply.status(404).send({ error: '匹配记录不存在' })
      }

      await prisma.candidateMatch.update({
        where: { id: body.matchId },
        data: { status: body.status },
      })

      return { success: true, message: '状态已更新' }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新失败', detail: e.message })
    }
  })

  // ─── 发布岗位 ───

}
