/**
 * talent.routes.ts — AI人才猎聘 Agent API
 *
 * Phase 2-P3: 企业 AI 招聘部门
 * - 人才画像引擎
 * - 主动人才推荐
 * - 人才关系管理
 * - AI人才雷达
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { TalentSearchAgent } from '../agents/job/talent-search-agent'

const prisma = new PrismaClient()

export async function talentRoutes(fastify: FastifyInstance) {

  // 503: Talent 关系尚未完成同步
  fastify.addHook('onRequest', async (_request, reply) => {
    return reply.status(503).send({ error: 'Talent Pool module is under maintenance', module: 'talent-pool', status: 'maintenance' })
  })

  // ─── 创建人才搜索任务 ───

  fastify.post('/api/enterprise/talent/search', async (request, reply) => {
    const body = request.body as {
      workspaceId: string
      enterpriseId: string
      title: string
      description?: string
      skills?: string[]
      city?: string
      salaryMin?: number
      salaryMax?: number
      careerLevel?: string
      education?: string
      experienceYears?: number
      limit?: number
    }

    if (!body.workspaceId || !body.enterpriseId || !body.title) {
      return reply.status(400).send({ error: 'workspaceId, enterpriseId, title 都是必填' })
    }

    try {
      // 创建搜索任务
      const task = await prisma.talentSearchTask.create({
        data: {
          workspaceId: body.workspaceId,
          enterpriseId: body.enterpriseId,
          title: body.title,
          description: body.description,
          requirements: {
            skills: body.skills || [],
            city: body.city || '',
            salaryMin: body.salaryMin || 0,
            salaryMax: body.salaryMax || 999,
            careerLevel: body.careerLevel || '',
            education: body.education || '',
            experienceYears: body.experienceYears || 0,
          },
          status: 'processing',
        },
      })

      // 获取候选人池（多源整合）
      const candidates = await gatherCandidatePool(body.enterpriseId)

      // 执行搜索
      const agent = new TalentSearchAgent()
      const results = agent.searchTalents(
        {
          workspaceId: body.workspaceId,
          enterpriseId: body.enterpriseId,
          title: body.title,
          skills: body.skills,
          city: body.city,
          salaryMin: body.salaryMin,
          salaryMax: body.salaryMax,
          careerLevel: body.careerLevel,
          education: body.education,
          experienceYears: body.experienceYears,
          limit: body.limit || 10,
        },
        candidates
      )

      // 保存推荐记录 — Sprint-SSOT-CLEANUP-01: 不再写入 TalentProfile
      // TalentProfile 已废弃，搜索结果直接返回不落库旧模型
      const savedRecommendations = results.map((result, i) => ({
        id: `idx-${task.id}-${i}`,
        name: result.name,
        matchScore: result.matchScore,
        matchBreakdown: result.matchBreakdown,
        recommendReason: result.recommendReason,
        risks: result.risks,
        talent: result.talent,
      }))

      // 更新任务状态
      await prisma.talentSearchTask.update({
        where: { id: task.id },
        data: { status: 'completed', resultCount: savedRecommendations.length },
      })

      return {
        success: true,
        taskId: task.id,
        recommendations: savedRecommendations,
        totalCandidates: candidates.length,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '人才搜索失败', detail: e.message })
    }
  })

  // ─── 获取搜索结果 ───

  fastify.get('/api/enterprise/talent/recommendations', async (request, reply) => {
    const { taskId, workspaceId } = request.query as { taskId?: string; workspaceId?: string }

    if (!taskId && !workspaceId) {
      return reply.status(400).send({ error: 'taskId 或 workspaceId 至少填一个' })
    }

    try {
      const recommendations = await prisma.talentRecommendation.findMany({
        where: {
          ...(taskId ? { taskId } : {}),
          ...(workspaceId ? { task: { workspaceId } } : {}),
        },
        include: {
          talent: true,
          task: { select: { title: true, status: true } },
        },
        orderBy: { matchScore: 'desc' },
        take: 50,
      })

      return {
        recommendations: recommendations.map(r => ({
          id: r.id,
          taskId: r.taskId,
          taskTitle: r.task?.title || '',
          talentId: r.talentId,
          name: r.talent?.name || '',
          matchScore: r.matchScore,
          matchBreakdown: r.matchBreakdown,
          recommendReason: r.recommendReason,
          risks: r.risks,
          status: r.status,
          talent: {
            education: r.talent?.education,
            skills: r.talent?.skills,
            experience: r.talent?.experience,
            city: r.talent?.city,
            careerLevel: r.talent?.careerLevel,
            strengths: r.talent?.strengths,
          },
          createdAt: r.createdAt,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取推荐失败', detail: e.message })
    }
  })

  // ─── 获取人才画像 — Sprint-SSOT-CLEANUP-01: TalentProfile → CareerProfile ───

  fastify.get('/api/enterprise/talent/profile/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const profile = await prisma.careerProfile.findUnique({
        where: { id },
        include: {
          educations: { orderBy: { startDate: 'desc' }, take: 5 },
          workExperiences: { orderBy: { startDate: 'desc' }, take: 5 },
          skills: { include: { skill: { select: { name: true, category: true } } } },
        },
      })

      if (!profile) {
        return reply.status(404).send({ error: '人才画像不存在' })
      }

      return { profile }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取人才画像失败', detail: e.message })
    }
  })

  // ─── 人才关系列表 ───

  fastify.get('/api/enterprise/talent/relationships', async (request, reply) => {
    const { workspaceId, stage } = request.query as { workspaceId?: string; stage?: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const relationships = await prisma.talentRelationship.findMany({
        where: {
          workspaceId,
          ...(stage ? { stage } : {}),
        },
        include: {
          talent: {
            select: {
              name: true,
              skills: true,
              city: true,
              careerLevel: true,
              education: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      })

      return {
        relationships: relationships.map(r => ({
          id: r.id,
          talentId: r.talentId,
          stage: r.stage,
          note: r.note,
          lastContactAt: r.lastContactAt,
          createdAt: r.createdAt,
          talent: r.talent,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取人才关系失败', detail: e.message })
    }
  })

  // ─── 更新人才关系 ───

  fastify.post('/api/enterprise/talent/relationship', async (request, reply) => {
    const body = request.body as {
      workspaceId: string
      enterpriseId: string
      talentId: string
      stage: string
      note?: string
    }

    if (!body.workspaceId || !body.talentId || !body.stage) {
      return reply.status(400).send({ error: 'workspaceId, talentId, stage 都是必填' })
    }

    try {
      // 查找或创建关系
      const existing = await prisma.talentRelationship.findFirst({
        where: {
          workspaceId: body.workspaceId,
          talentId: body.talentId,
        },
      })

      if (existing) {
        const updated = await prisma.talentRelationship.update({
          where: { id: existing.id },
          data: {
            stage: body.stage,
            note: body.note,
            lastContactAt: new Date(),
          },
        })
        return { success: true, relationship: updated }
      } else {
        const created = await prisma.talentRelationship.create({
          data: {
            workspaceId: body.workspaceId,
            enterpriseId: body.enterpriseId,
            talentId: body.talentId,
            stage: body.stage,
            note: body.note,
          },
        })
        return { success: true, relationship: created }
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新人才关系失败', detail: e.message })
    }
  })

  // ─── 人才统计 ───

  fastify.get('/api/enterprise/talent/stats', async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const [totalTalents, totalRelationships, stageCounts, recentSearches] = await Promise.all([
        prisma.careerProfile.count(),
        prisma.talentRelationship.count({ where: { workspaceId } }),
        prisma.talentRelationship.groupBy({
          by: ['stage'],
          where: { workspaceId },
          _count: { stage: true },
        }),
        prisma.talentSearchTask.count({
          where: { workspaceId },
        }),
      ])

      return {
        stats: {
          totalTalents,
          totalRelationships,
          recentSearches,
          stageCounts: stageCounts.reduce((acc, s) => {
            acc[s.stage] = s._count.stage
            return acc
          }, {} as Record<string, number>),
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取统计失败', detail: e.message })
    }
  })

  // ─── 搜索任务列表 ───

  fastify.get('/api/enterprise/talent/tasks', async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const tasks = await prisma.talentSearchTask.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      return {
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          resultCount: t.resultCount,
          createdAt: t.createdAt,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取搜索任务失败', detail: e.message })
    }
  })
}

// ─── 辅助函数：整合候选人池 ───

async function gatherCandidatePool(enterpriseId: string) {
  const candidates: any[] = []

  // 1. 从求职者画像获取 — Sprint-SSOT-CLEANUP-01: JobCandidate → CareerProfile
  const careerProfiles = await prisma.careerProfile.findMany({
    take: 100,
    select: {
      id: true,
      fullName: true,
      headline: true,
      city: true,
      bio: true,
      skills: { select: { name: true } },
      workExperiences: { select: { title: true, company: true } },
      educations: { select: { degree: true, field: true } },
    },
  })

  for (const cp of careerProfiles) {
    candidates.push({
      id: cp.id,
      name: cp.fullName || '求职者',
      skills: cp.skills?.map(s => s.name) || [],
      experience: cp.workExperiences?.[0]?.title || cp.headline || '',
      experienceYears: 0,
      city: cp.city || '',
      salaryMin: 0,
      salaryMax: 0,
      education: cp.educations?.[0]?.degree || cp.educations?.[0]?.field || '',
      careerLevel: '',
      strengths: [],
      sourceType: 'candidate',
    })
  }

  // 2. 从简历解析结果获取
  const resumeProfiles = await prisma.resumeProfile.findMany({
    take: 100,
  })

  for (const rp of resumeProfiles) {
    candidates.push({
      id: rp.id,
      name: rp.name || '候选人',
      skills: rp.skills || [],
      experience: rp.experience || '',
      experienceYears: rp.experienceYears || 0,
      city: rp.city || '',
      salaryMin: rp.salaryMin || 0,
      salaryMax: rp.salaryMax || 0,
      education: rp.education || '',
      careerLevel: '',
      strengths: rp.strengths || [],
      sourceType: 'resume',
    })
  }

  // 3. 从 CareerProfile 补充（原 TalentProfile 源）— Sprint-SSOT-CLEANUP-01
  const extraProfiles = await prisma.careerProfile.findMany({
    take: 100,
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      headline: true,
      bio: true,
      city: true,
      yearsExperience: true,
      currentLevel: true,
      careerDirection: true,
      skills: { select: { name: true } },
      workExperiences: { take: 1, select: { title: true, company: true } },
      educations: { take: 1, select: { degree: true, field: true } },
    },
  })

  for (const cp of extraProfiles) {
    candidates.push({
      id: cp.id,
      name: cp.fullName,
      skills: cp.skills?.map(s => s.name) || [],
      experience: cp.workExperiences?.[0]?.title || cp.headline || '',
      experienceYears: cp.yearsExperience || 0,
      city: cp.city || '',
      salaryMin: 0,
      salaryMax: 0,
      education: cp.educations?.[0]?.degree || cp.educations?.[0]?.field || '',
      careerLevel: cp.currentLevel || '',
      strengths: [],
      sourceType: 'talent',
    })
  }

  return candidates
}
