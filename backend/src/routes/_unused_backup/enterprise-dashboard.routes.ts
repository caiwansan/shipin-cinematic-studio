/**
 * enterprise-dashboard.routes.ts — CEO Dashboard API
 *
 * Phase 5-A2: 企业AI部门控制台
 * 聚合真实数据：AI员工状态 / 招聘漏斗 / 成本 / 工作日报
 *
 * 核心原则：所有数据来自真实表，空状态明确，禁止假数字。
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function enterpriseDashboardRoutes(fastify: FastifyInstance) {

  // ─── CEO Dashboard 主接口 ───

  fastify.get('/api/enterprise/dashboard', async (request, reply) => {
    const { enterpriseId } = request.query as { enterpriseId?: string }
    if (!enterpriseId) {
      return reply.status(400).send({ error: 'enterpriseId is required' })
    }

    // 503: Dashboard 依赖的 Prisma 模型关系尚未完成同步
    try {
      // 验证 Prisma Client 是否包含所需关系
      if (typeof prisma.recruitmentPipeline.findMany !== 'function') {
        return reply.status(503).send({ error: 'Enterprise recruitment module is under maintenance', module: 'dashboard', status: 'maintenance' })
      }
      // 1. enterpriseId 是 JobCompanyProfile.id
      const jcp = await prisma.jobCompanyProfile.findUnique({
        where: { id: enterpriseId },
        include: {
          enterprise: {
            include: {
              organization: {
                select: { name: true },
              },
            },
          },
        },
      })

      const workspace = jcp
        ? await prisma.enterpriseJobWorkspace.findUnique({
            where: { enterpriseId: jcp.id },
            include: {
              enterprise: {
                include: {
                  enterprise: {
                    include: {
                      organization: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
            },
          })
        : null

      if (!workspace) {
        return {
          success: true,
          exists: false,
          message: '企业招聘空间尚未创建',
          redirectTo: '/workspace/enterprise/onboarding',
        }
      }

      // 2. AI 员工编制状态
      const workforce = await prisma.enterpriseAgentWorkforce.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { sortOrder: 'asc' },
      })

      const workforceStats = {
        total: workforce.length,
        active: workforce.filter(w => w.status === 'active').length,
        trial: workforce.filter(w => w.status === 'trial').length,
        paused: workforce.filter(w => w.status === 'paused').length,
        disabled: workforce.filter(w => w.status === 'disabled').length,
      }

      // 3. 招聘流程漏斗（来自真实 RecruitmentPipeline）
      const pipelines = await prisma.recruitmentPipeline.findMany({
        where: { workspaceId: workspace.id },
      })

      const funnel = {
        total: pipelines.length,
        discovered: pipelines.filter(p => p.stage === 'discovered').length,
        screening: pipelines.filter(p => p.stage === 'screening').length,
        interview: pipelines.filter(p => p.stage === 'interview').length,
        offer: pipelines.filter(p => p.stage === 'offer').length,
        hired: pipelines.filter(p => p.stage === 'hired').length,
        rejected: pipelines.filter(p => p.stage === 'rejected').length,
      }

      // 4. 岗位数据
      const postings = await prisma.jobPosting.findMany({
        where: { enterpriseId, status: 'active' },
        select: { id: true, title: true },
      })

      // 5. 面试统计
      const interviews = await prisma.interviewSession.findMany({
        where: { workspaceId: workspace.id },
      })

      const interviewStats = {
        total: interviews.length,
        preparing: interviews.filter(i => i.status === 'preparing').length,
        ongoing: interviews.filter(i => i.status === 'ongoing').length,
        completed: interviews.filter(i => i.status === 'completed').length,
      }

      // 6. 成本数据（从 AI 员工月度统计聚合）
      let totalMonthlyTokens = 0
      let totalMonthlyCost = 0
      for (const w of workforce) {
        totalMonthlyTokens += w.monthlyTokens || 0
        totalMonthlyCost += Number(w.monthlyCost) || 0
      }

      // 7. 最近 AI 任务（来自 InterviewSession + Resume 分析）
      const recentResumes = await prisma.resume.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          candidateName: true,
          status: true,
          createdAt: true,
        },
      })

      // 8. 招聘需求
      const needs = await prisma.enterpriseRecruitmentNeeds.findUnique({
        where: { workspaceId: workspace.id },
      })

      // 组装 Dashboard 数据
      return {
        success: true,
        exists: true,
        enterprise: {
          id: enterpriseId,
          name: workspace.enterprise?.enterprise?.organization?.name || workspace.name,
          industry: workspace.enterprise?.industry || '',
          scale: workspace.enterprise?.scale || '',
          plan: workspace.plan || 'trial',
          planLabel: getPlanLabel(workspace.plan),
        },
        workforce: {
          stats: workforceStats,
          agents: workforce.map(w => ({
            id: w.id,
            agentType: w.agentType,
            displayName: w.displayName,
            status: w.status,
            trialEndsAt: w.trialEndsAt,
            monthlyCalls: w.monthlyCalls || 0,
            monthlyTokens: w.monthlyTokens || 0,
            roleDescription: w.roleDescription,
          })),
        },
        recruitment: {
          postings: postings.map(p => ({ id: p.id, title: p.title })),
          postingsCount: postings.length,
          funnel,
          interviews: interviewStats,
        },
        cost: {
          totalMonthlyTokens,
          totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
          currency: 'CNY',
        },
        recentResumes: recentResumes.map(r => ({
          id: r.id,
          candidateName: r.candidateName || '未命名',
          qualityScore: r.qualityScore || 0,
          analyzedAt: r.createdAt,
        })),
        needs: needs ? {
          targetPositions: needs.targetPositions,
          monthlyHireTarget: needs.monthlyHireTarget,
          urgentPosition: needs.urgentPosition,
        } : null,
      }
    } catch (e: any) {
      console.error('Dashboard API 错误:', e)
      return reply.status(500).send({ error: '获取Dashboard数据失败', detail: e.message })
    }
  })

  // ─── AI 员工月度报表 ───

  fastify.get('/api/enterprise/dashboard/report', async (request, reply) => {
    const { enterpriseId, period } = request.query as {
      enterpriseId?: string
      period?: 'day' | 'week' | 'month'
    }

    if (!enterpriseId) {
      return reply.status(400).send({ error: 'enterpriseId is required' })
    }

    // 503: Dashboard 依赖的 Prisma 模型关系尚未完成同步
    try {
      if (typeof prisma.recruitmentPipeline.count !== 'function') {
        return reply.status(503).send({ error: 'Enterprise recruitment module is under maintenance', module: 'dashboard-report', status: 'maintenance' })
      }
      const workspace = await prisma.enterpriseJobWorkspace.findUnique({
        where: { enterpriseId },
      })

      if (!workspace) {
        return { success: true, report: null, message: '企业空间尚未创建' }
      }

      const now = new Date()
      let startDate: Date
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
      }

      // 本月新增简历
      const newResumes = await prisma.resume.count({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: startDate },
        },
      })

      // 本月新增面试
      const newInterviews = await prisma.interviewSession.count({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: startDate },
        },
      })

      // 本月完成面试
      const completedInterviews = await prisma.interviewSession.count({
        where: {
          workspaceId: workspace.id,
          status: 'completed',
          completedAt: { gte: startDate },
        },
      })

      // 本月进入 Offer 阶段
      const newOffers = await prisma.recruitmentPipeline.count({
        where: {
          workspaceId: workspace.id,
          stage: 'offer',
          updatedAt: { gte: startDate },
        },
      })

      // 平均面试评分
      const evaluations = await prisma.interviewEvaluation.findMany({
        where: {
          session: { workspaceId: workspace.id },
          createdAt: { gte: startDate },
        },
        select: { overallScore: true },
      })

      const avgScore = evaluations.length > 0
        ? Math.round(evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length)
        : 0

      return {
        success: true,
        period: period || 'month',
        report: {
          newResumes,
          newInterviews,
          completedInterviews,
          newOffers,
          avgScore,
          totalEvaluations: evaluations.length,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取报表失败', detail: e.message })
    }
  })
}

function getPlanLabel(plan: string | null): string {
  switch (plan) {
    case 'starter': return 'Starter ¥999/月'
    case 'professional': return 'Professional ¥2999/月'
    case 'enterprise': return 'Enterprise ¥9999/月'
    case 'trial': return '14天免费试用'
    default: return '未选择套餐'
  }
}
