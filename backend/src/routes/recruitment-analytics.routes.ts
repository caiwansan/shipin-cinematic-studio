/**
 * recruitment-analytics.routes.ts — 招聘 ROI 分析 API
 * Sprint-09: Growth Reality — 让企业清楚看到"用了以后赚到了"
 *
 * 核心指标：
 * - 招聘效率：招聘周期缩短比例、AI 处理候选数量、节省人工时间
 * - 成本价值：AI 招聘成本 vs 人工招聘成本、节省金额、ROI
 * - 数据来源：JobPosting、CandidateMatch、PipelineEvent、UsageLog、InterviewSession
 *
 * Tenant 隔离：所有查询严格按 enterpriseId/workspaceId 隔离
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { resolveEnterpriseId as resolveUserEnterpriseId } from '../services/enterprise-context.service.js'

// ─── 行业基准常量（用于对比） ───
const INDUSTRY_BENCHMARKS = {
  avgHireDays: 44, // 传统招聘平均周期（天）
  avgScreeningTimePerCandidate: 23, // 传统筛选每候选人的平均时间（分钟）
  avgCostPerHire: 4700, // 传统招聘平均单人次成本（元）
  avgInterviewPerCandidate: 45, // 传统面试每候选人的平均时间（分钟）
  aiCostPerCall: 0.15, // AI 单次调用成本估算（元）
}

// ─── Helper: resolve workspaceId → enterpriseId ───
async function resolveEnterpriseId(workspaceId?: string): Promise<string | null> {
  if (!workspaceId) return null
  const workspace = await prisma.enterpriseJobWorkspace.findUnique({
    where: { id: workspaceId },
    select: { enterpriseId: true },
  })
  return workspace?.enterpriseId || null
}

// ─── Helper: resolve enterpriseId → workspaceId ───
async function resolveWorkspaceId(enterpriseId: string): Promise<string | null> {
  const workspace = await prisma.enterpriseJobWorkspace.findUnique({
    where: { enterpriseId },
    select: { id: true },
  })
  return workspace?.id || null
}

// ─── 空数据响应（前端 expects 全字段） ───
function emptyResponse() {
  return {
    success: true,
    data: {
      efficiency: {
        avgHireDays: 0, industryAvgHireDays: INDUSTRY_BENCHMARKS.avgHireDays,
        hireDaysReduction: 0, aiProcessedCandidates: 0,
        monthlyProcessedCandidates: 0, savedScreeningHours: 0,
        savedScreeningMinutes: 0,
      },
      costValue: {
        aiCostMonthly: 0, aiCostYearly: 0, manualCostTotal: 0,
        manualScreeningCost: 0, manualInterviewCost: 0, manualRecruitmentCost: 0,
        savings: 0, roi: 0,
      },
      funnel: {
        totalJobs: 0, activeJobs: 0, totalMatches: 0, highQualityMatches: 0,
        totalInterviews: 0, completedInterviews: 0, conversionRate: 0,
      },
      monthlyTrend: [],
      benchmarks: INDUSTRY_BENCHMARKS,
    },
  }
}

export const recruitmentAnalyticsRoutes = async (fastify: FastifyInstance) => {

  // ─── JWT Auth for all routes ───
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ─── GET /api/enterprise/recruitment-analytics/roi — ROI Dashboard 主接口 ───
  fastify.get('/api/enterprise/recruitment-analytics/roi', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      let { workspaceId } = request.query as { workspaceId?: string }

      // 自动解析 workspaceId（与 capability 端点对齐）
      if (!workspaceId && userId) {
        // 策略1: EnterpriseProfile → JobCompanyProfile → workspace
        const profile = await prisma.enterpriseProfile.findFirst({
          where: { organizationId: userId },
          select: { id: true },
        })
        if (profile?.id) workspaceId = await resolveWorkspaceId(profile.id) || undefined

        // 策略2: OrgMember → Organization → EnterpriseProfile → workspace
        if (!workspaceId) {
          const member = await prisma.orgMember.findFirst({
            where: { userId },
            include: { organization: true },
          })
          if (member?.organization) {
            const ep2 = await prisma.enterpriseProfile.findFirst({
              where: { organizationId: member.organization.id },
              select: { id: true },
            })
            if (ep2?.id) workspaceId = await resolveWorkspaceId(ep2.id) || undefined
          }
        }
      }

      const enterpriseId = workspaceId ? await resolveEnterpriseId(workspaceId) : null
      if (!enterpriseId) {
        return reply.status(200).send(emptyResponse())
      }

      const wsId = workspaceId
      if (!wsId) {
        return reply.status(200).send(emptyResponse())
      }

      // ─── 1. 招聘效率指标 ───
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // 招聘周期：从岗位创建到候选人进入面试的平均天数
      const jobsWithHires = await prisma.jobPosting.findMany({
        where: { enterpriseId },
        select: {
          id: true,
          createdAt: true,
          interviewSessions: {
            where: { status: { in: ['completed', 'decision_made'] } },
            select: { createdAt: true },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      })

      let avgHireDays = INDUSTRY_BENCHMARKS.avgHireDays
      const hireDaysList: number[] = []
      for (const job of jobsWithHires) {
        if (job.interviewSessions.length > 0) {
          const days = Math.ceil(
            (job.interviewSessions[0].createdAt.getTime() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          if (days > 0 && days < 365) {
            hireDaysList.push(days)
          }
        }
      }
      if (hireDaysList.length > 0) {
        avgHireDays = Math.round(hireDaysList.reduce((a, b) => a + b, 0) / hireDaysList.length)
      }

      const hireDaysReduction = Math.max(0, Math.round(
        ((INDUSTRY_BENCHMARKS.avgHireDays - avgHireDays) / INDUSTRY_BENCHMARKS.avgHireDays) * 100
      ))

      // AI 处理候选数量
      const aiProcessedCandidates = await prisma.candidateMatch.count({
        where: { workspaceId: wsId },
      })

      // 本月处理候选数量
      const monthlyProcessedCandidates = await prisma.candidateMatch.count({
        where: {
          workspaceId: wsId,
          createdAt: { gte: thirtyDaysAgo },
        },
      })

      // 节省人工筛选时间（估算）
      const savedScreeningMinutes = aiProcessedCandidates * INDUSTRY_BENCHMARKS.avgScreeningTimePerCandidate
      const savedScreeningHours = Math.round(savedScreeningMinutes / 60)

      // ─── 2. 成本价值分析 ───

      // AI 招聘成本（基于 UsageLog）
      const usageLogs = await prisma.usageLog.findMany({
        where: {
          tenantId: enterpriseId,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { cost: true, taskType: true },
      })

      const aiCostTotal = usageLogs.reduce((sum, log) => sum + (log.cost || 0), 0)
      const aiCostMonthly = Math.round(aiCostTotal * 100) / 100

      // 估算 AI 年化成本
      const aiCostYearly = Math.round(aiCostMonthly * 12 * 100) / 100

      // 人工招聘成本估算
      const totalHires = await prisma.interviewSession.count({
        where: {
          workspaceId: wsId,
          status: { in: ['completed', 'decision_made'] },
        },
      })

      const totalConversations = await prisma.recruitmentConversation.count({
        where: { enterpriseId },
      })

      // 人工成本 = 筛选时间成本 + 面试时间成本 + 单次招聘成本
      const manualScreeningCost = Math.round(
        (aiProcessedCandidates * INDUSTRY_BENCHMARKS.avgScreeningTimePerCandidate / 60) * 50 // 50元/小时人工成本
      )
      const manualInterviewCost = Math.round(
        (totalHires * INDUSTRY_BENCHMARKS.avgInterviewPerCandidate / 60) * 75 // 75元/小时面试官成本
      )
      const manualRecruitmentCost = totalHires * INDUSTRY_BENCHMARKS.avgCostPerHire
      const manualCostTotal = manualScreeningCost + manualInterviewCost + manualRecruitmentCost

      // 节省金额
      const savings = Math.max(0, manualCostTotal - aiCostYearly)

      // ROI = (节省金额 / AI 成本) × 100%
      const roi = aiCostYearly > 0 ? Math.round((savings / aiCostYearly) * 100) : 0

      // ─── 3. 招聘漏斗数据 ───
      const totalJobs = await prisma.jobPosting.count({ where: { enterpriseId } })
      const activeJobs = await prisma.jobPosting.count({
        where: { enterpriseId, status: 'published' },
      })
      const totalMatches = await prisma.candidateMatch.count({
        where: { workspaceId: wsId },
      })
      const highQualityMatches = await prisma.candidateMatch.count({
        where: { workspaceId: wsId, matchScore: { gte: 70 } },
      })
      const totalInterviews = await prisma.interviewSession.count({
        where: { workspaceId: wsId },
      })
      const completedInterviews = await prisma.interviewSession.count({
        where: {
          workspaceId: wsId,
          status: { in: ['completed', 'decision_made'] },
        },
      })

      // ─── 4. 月度趋势（最近6个月） ───
      const monthlyTrend: Array<{
        month: string
        candidates: number
        interviews: number
        cost: number
      }> = []

      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        const monthLabel = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

        const [candidates, interviews, cost] = await Promise.all([
          prisma.candidateMatch.count({
            where: {
              workspaceId: wsId,
              createdAt: { gte: monthStart, lt: monthEnd },
            },
          }),
          prisma.interviewSession.count({
            where: {
              workspaceId: wsId,
              createdAt: { gte: monthStart, lt: monthEnd },
            },
          }),
          prisma.usageLog.aggregate({
            where: {
              tenantId: enterpriseId,
              createdAt: { gte: monthStart, lt: monthEnd },
            },
            _sum: { cost: true },
          }),
        ])

        monthlyTrend.push({
          month: monthLabel,
          candidates,
          interviews,
          cost: Math.round((cost._sum.cost || 0) * 100) / 100,
        })
      }

      return reply.status(200).send({
        success: true,
        data: {
          // 招聘效率
          efficiency: {
            avgHireDays,
            industryAvgHireDays: INDUSTRY_BENCHMARKS.avgHireDays,
            hireDaysReduction,
            aiProcessedCandidates,
            monthlyProcessedCandidates,
            savedScreeningHours,
            savedScreeningMinutes,
          },
          // 成本价值
          costValue: {
            aiCostMonthly,
            aiCostYearly,
            manualCostTotal,
            manualScreeningCost,
            manualInterviewCost,
            manualRecruitmentCost,
            savings,
            roi,
          },
          // 招聘漏斗
          funnel: {
            totalJobs,
            activeJobs,
            totalMatches,
            highQualityMatches,
            totalInterviews,
            completedInterviews,
            conversionRate: totalMatches > 0 ? Math.round((totalInterviews / totalMatches) * 100) : 0,
          },
          // 月度趋势
          monthlyTrend,
          // 行业基准
          benchmarks: INDUSTRY_BENCHMARKS,
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-analytics] roi: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /api/enterprise/recruitment-analytics/capability — AI 员工能力中心数据 ───
  fastify.get('/api/enterprise/recruitment-analytics/capability', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      let { workspaceId } = request.query as { workspaceId?: string }

      // 没有 workspaceId 时从 JWT 自动解析
      if (!workspaceId && userId) {
        // 策略1: EnterpriseProfile → JobCompanyProfile → workspace
        const profile = await prisma.enterpriseProfile.findFirst({
          where: { organizationId: userId },
          select: { id: true },
        })
        if (profile?.id) workspaceId = await resolveWorkspaceId(profile.id) || undefined

        // 策略2: 从 OrgMember 找到 org → EnterpriseProfile → workspace
        if (!workspaceId) {
          const member = await prisma.orgMember.findFirst({
            where: { userId },
            include: { organization: true },
          })
          if (member?.organization) {
            const ep2 = await prisma.enterpriseProfile.findFirst({
              where: { organizationId: member.organization.id },
              select: { id: true },
            })
            if (ep2?.id) workspaceId = await resolveWorkspaceId(ep2.id) || undefined

            // 策略3: EnterpriseProfile 不存在时，直接使用 OrgMember 的 organizationId
            if (!workspaceId) {
              // 用 orgId 直接查询 AgentProfile
              const orgId = member.organization.id || member.organizationId
              if (orgId) {
                // 标记为 orgId 直查模式
                ;(request as any)._resolutionOrgId = orgId
              }
            }
          }
        }
      }

      const wsId = workspaceId

      // ─── Fallback: 如果 workspace 解析失败，直接从 Org + AgentProfile 加载 ───
      const resolutionOrgId = (request as any)._resolutionOrgId as string | undefined

      if (!wsId && !resolutionOrgId) {
        return reply.status(200).send({
          success: true,
          data: {
            agents: [],
            summary: {
              totalMonthlyTasks: 0,
              totalAnalyzedCandidates: 0,
              totalInterviews: 0,
              completedInterviews: 0,
              taskCompletionRate: 0,
            },
          },
        })
      }

      const enterpriseId = wsId ? (await resolveEnterpriseId(wsId)) : ''

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // ─── AI 员工能力统计 ───
      const workforce = await prisma.enterpriseAgentWorkforce.findMany({
        where: { workspaceId: wsId },
        orderBy: { sortOrder: 'asc' },
      })

      // ─── Fallback: Workforce 为空时，直接从 AgentProfile + CapabilityBinding 查询 ───
      let agentProfiles: any[] = workforce
      if (workforce.length === 0 && resolutionOrgId) {
        agentProfiles = await prisma.enterpriseAgentProfile.findMany({
          where: {
            organizationId: resolutionOrgId,
            status: 'active',
          },
          orderBy: { createdAt: 'asc' },
        })
      }

      const agentCapabilities = await Promise.all(
        (agentProfiles as any[]).map(async (emp: any) => {
          // wf: workforce fields, ap: agent profile fields
          const isWorkforce = !!(emp as any).workspaceId
          const agentType = isWorkforce ? (emp as any).agentType : (emp as any).agentType

          // 如果是 AgentProfile 模式，查询能力绑定
          let capabilityCodes: string[] = []
          let defShortName = ''
          let defDescription = ''
          let defCapabilities: string[] = []

          if (!isWorkforce) {
            const bindings = await prisma.employeeCapabilityBinding.findMany({
              where: {
                employeeId: (emp as any).id,
                status: 'active',
              },
              select: { capabilityCode: true },
            })
            capabilityCodes = bindings.map(b => b.capabilityCode)
            defShortName = (emp as any).name || ''
            defDescription = (emp as any).description || ''
          } else {
            const def = getAgentDef(agentType)
            defShortName = def.shortName
            defDescription = def.description
            defCapabilities = def.capabilities
          }

          // 本月完成任务数（基于 UsageLog）
          const monthlyTasks = enterpriseId
            ? await prisma.usageLog.count({
                where: {
                  tenantId: enterpriseId,
                  createdAt: { gte: thirtyDaysAgo },
                },
              })
            : 0

          // 分析候选人数（基于 CandidateMatch）
          const analyzedCandidates = await prisma.candidateMatch.count({
            where: { workspaceId: wsId },
          })

          // 面试评估数（基于 InterviewSession）
          const interviewsEvaluated = await prisma.interviewSession.count({
            where: {
              workspaceId: wsId,
              status: { in: ['completed', 'decision_made'] },
            },
          })

          // 本月使用量趋势（按周）
          const weeklyUsage: Array<{ week: string; count: number }> = []
          if (enterpriseId) {
            for (let i = 3; i >= 0; i--) {
              const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
              weekStart.setHours(0, 0, 0, 0)
              const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

              const count = await prisma.usageLog.count({
                where: {
                  tenantId: enterpriseId,
                  createdAt: { gte: weekStart, lt: weekEnd },
                },
              })

              weeklyUsage.push({
                week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
                count,
              })
            }
          }

          const profileName = isWorkforce ? (emp as any).displayName : (emp as any).name
          return {
            id: (emp as any).id,
            agentType,
            name: profileName,
            shortName: defShortName,
            description: defDescription,
            capabilities: isWorkforce ? defCapabilities : capabilityCodes,
            status: isWorkforce ? (emp as any).status : (emp as any).status,
            monthlyTasks,
            analyzedCandidates,
            interviewsEvaluated,
            weeklyUsage,
            monthlyCalls: isWorkforce ? (emp as any).monthlyCalls : 0,
            monthlyTokens: isWorkforce ? (emp as any).monthlyTokens : 0,
            monthlyCost: isWorkforce ? (emp as any).monthlyCost : 0,
          }
        })
      )

      // ─── 整体成长趋势 ───
      const totalMonthlyTasks = enterpriseId
        ? await prisma.usageLog.count({
            where: {
              tenantId: enterpriseId,
              createdAt: { gte: thirtyDaysAgo },
            },
          })
        : 0

      const totalAnalyzedCandidates = wsId
        ? await prisma.candidateMatch.count({ where: { workspaceId: wsId } })
        : 0

      const totalInterviews = wsId
        ? await prisma.interviewSession.count({ where: { workspaceId: wsId } })
        : 0

      const completedInterviews = wsId
        ? await prisma.interviewSession.count({
            where: {
              workspaceId: wsId,
              status: { in: ['completed', 'decision_made'] },
            },
          })
        : 0

      const taskCompletionRate = totalInterviews > 0
        ? Math.round((completedInterviews / totalInterviews) * 100)
        : 0

      return reply.status(200).send({
        success: true,
        data: {
          agents: agentCapabilities,
          summary: {
            totalMonthlyTasks,
            totalAnalyzedCandidates,
            totalInterviews,
            completedInterviews,
            taskCompletionRate,
          },
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-analytics] capability: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /api/enterprise/recruitment-analytics/automation — 招聘自动化状态 ───
  fastify.get('/api/enterprise/recruitment-analytics/automation', async (request, reply) => {
    try {
      const { workspaceId } = request.query as { workspaceId?: string }

      const enterpriseId = await resolveEnterpriseId(workspaceId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'Invalid workspaceId' })
      }

      const wsId = workspaceId || (await resolveWorkspaceId(enterpriseId))
      if (!wsId) {
        return reply.status(400).send({ error: 'Workspace not found' })
      }

      // ─── 自动化配置 ───
      const config = await prisma.recruitmentAutomationConfig.findUnique({
        where: { workspaceId: wsId },
      })

      // ─── 自动化执行统计 ───
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const autoJobsCreated = await prisma.jobPosting.count({
        where: {
          enterpriseId,
          createdAt: { gte: thirtyDaysAgo },
          // 自动创建的岗位（通过自动化流程）
        },
      })

      const autoMatches = await prisma.candidateMatch.count({
        where: {
          workspaceId: wsId,
          createdAt: { gte: thirtyDaysAgo },
        },
      })

      const autoInterviews = await prisma.interviewSession.count({
        where: {
          workspaceId: wsId,
          createdAt: { gte: thirtyDaysAgo },
        },
      })

      return reply.status(200).send({
        success: true,
        data: {
          config: config || {
            workspaceId: wsId,
            enterpriseId,
            autoJdGeneration: false,
            autoTalentSearch: false,
            autoMatchFiltering: false,
            autoInterviewScheduling: false,
            matchThreshold: 70,
            notifyOnMatch: true,
            notifyOnInterview: true,
          },
          stats: {
            autoJobsCreated,
            autoMatches,
            autoInterviews,
          },
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-analytics] automation: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── PUT /api/enterprise/recruitment-analytics/automation/config — 更新自动化配置 ───
  fastify.put('/api/enterprise/recruitment-analytics/automation/config', async (request, reply) => {
    try {
      const { workspaceId } = request.query as { workspaceId?: string }

      const enterpriseId = await resolveEnterpriseId(workspaceId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'Invalid workspaceId' })
      }

      const wsId = workspaceId || (await resolveWorkspaceId(enterpriseId))
      if (!wsId) {
        return reply.status(400).send({ error: 'Workspace not found' })
      }

      const body = request.body as {
        autoJdGeneration?: boolean
        autoTalentSearch?: boolean
        autoMatchFiltering?: boolean
        autoInterviewScheduling?: boolean
        matchThreshold?: number
        notifyOnMatch?: boolean
        notifyOnInterview?: boolean
      }

      const config = await prisma.recruitmentAutomationConfig.upsert({
        where: { workspaceId: wsId },
        update: {
          ...(body.autoJdGeneration !== undefined ? { autoJdGeneration: body.autoJdGeneration } : {}),
          ...(body.autoTalentSearch !== undefined ? { autoTalentSearch: body.autoTalentSearch } : {}),
          ...(body.autoMatchFiltering !== undefined ? { autoMatchFiltering: body.autoMatchFiltering } : {}),
          ...(body.autoInterviewScheduling !== undefined ? { autoInterviewScheduling: body.autoInterviewScheduling } : {}),
          ...(body.matchThreshold !== undefined ? { matchThreshold: body.matchThreshold } : {}),
          ...(body.notifyOnMatch !== undefined ? { notifyOnMatch: body.notifyOnMatch } : {}),
          ...(body.notifyOnInterview !== undefined ? { notifyOnInterview: body.notifyOnInterview } : {}),
        },
        create: {
          workspaceId: wsId,
          enterpriseId,
          autoJdGeneration: body.autoJdGeneration ?? false,
          autoTalentSearch: body.autoTalentSearch ?? false,
          autoMatchFiltering: body.autoMatchFiltering ?? false,
          autoInterviewScheduling: body.autoInterviewScheduling ?? false,
          matchThreshold: body.matchThreshold ?? 70,
          notifyOnMatch: body.notifyOnMatch ?? true,
          notifyOnInterview: body.notifyOnInterview ?? true,
        },
      })

      return reply.status(200).send({
        success: true,
        data: config,
      })
    } catch (error: any) {
      request.log.error(`[recruitment-analytics] update-config: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to update automation config' })
    }
  })

  // ─── GET /api/enterprise/recruitment-analytics/renewal — 续费价值指标 ───
  fastify.get('/api/enterprise/recruitment-analytics/renewal', async (request, reply) => {
    try {
      const { workspaceId } = request.query as { workspaceId?: string }

      const enterpriseId = await resolveEnterpriseId(workspaceId)
      if (!enterpriseId) {
        return reply.status(400).send({ error: 'Invalid workspaceId' })
      }

      const wsId = workspaceId || (await resolveWorkspaceId(enterpriseId))
      if (!wsId) {
        return reply.status(400).send({ error: 'Workspace not found' })
      }

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // ─── 使用频率 ───
      const monthlyUsage = await prisma.usageLog.count({
        where: {
          tenantId: enterpriseId,
          createdAt: { gte: thirtyDaysAgo },
        },
      })

      const weeklyUsageAvg = Math.round(monthlyUsage / 4)

      // ─── 招聘活跃度 ───
      const activeJobs = await prisma.jobPosting.count({
        where: { enterpriseId, status: 'published' },
      })

      const monthlyConversations = await prisma.recruitmentConversation.count({
        where: {
          enterpriseId,
          createdAt: { gte: thirtyDaysAgo },
        },
      })

      const monthlyInterviews = await prisma.interviewSession.count({
        where: {
          workspaceId: wsId,
          createdAt: { gte: thirtyDaysAgo },
        },
      })

      // ─── AI 依赖度 ───
      const totalTasks = await prisma.usageLog.count({
        where: { tenantId: enterpriseId },
      })

      const aiHandledTasks = await prisma.usageLog.count({
        where: { tenantId: enterpriseId },
      })

      const aiDependencyRate = totalTasks > 0
        ? Math.round((aiHandledTasks / totalTasks) * 100)
        : 0

      // ─── 招聘成功率 ───
      const totalInterviews = await prisma.interviewSession.count({
        where: { workspaceId: wsId },
      })

      const successfulInterviews = await prisma.interviewSession.count({
        where: {
          workspaceId: wsId,
          status: { in: ['completed', 'decision_made'] },
        },
      })

      const hireRate = totalInterviews > 0
        ? Math.round((successfulInterviews / totalInterviews) * 100)
        : 0

      // ─── 健康度评分（0-100） ───
      // 使用频率（30分）+ 招聘活跃度（30分）+ AI 依赖度（20分）+ 招聘成功率（20分）
      const usageScore = Math.min(30, Math.round((monthlyUsage / 100) * 30))
      const activityScore = Math.min(30, Math.round(((activeJobs + monthlyConversations + monthlyInterviews) / 10) * 30))
      const dependencyScore = Math.min(20, Math.round((aiDependencyRate / 100) * 20))
      const successScore = Math.min(20, Math.round((hireRate / 100) * 20))

      const healthScore = usageScore + activityScore + dependencyScore + successScore

      // ─── 续费风险等级 ───
      let renewalRisk: 'low' | 'medium' | 'high'
      if (healthScore >= 70) {
        renewalRisk = 'low'
      } else if (healthScore >= 40) {
        renewalRisk = 'medium'
      } else {
        renewalRisk = 'high'
      }

      // ─── 高价值标签 ───
      const isHighValue = monthlyUsage > 50 && activeJobs > 0 && aiDependencyRate > 60

      return reply.status(200).send({
        success: true,
        data: {
          healthScore,
          renewalRisk,
          isHighValue,
          metrics: {
            monthlyUsage,
            weeklyUsageAvg,
            activeJobs,
            monthlyConversations,
            monthlyInterviews,
            aiDependencyRate,
            hireRate,
          },
          scoreBreakdown: {
            usageScore,
            activityScore,
            dependencyScore,
            successScore,
          },
        },
      })
    } catch (error: any) {
      request.log.error(`[recruitment-analytics] renewal: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })
}

// ─── Helper: Agent 类型定义 ───
function getAgentDef(agentType: string): {
  shortName: string
  description: string
  capabilities: string[]
} {
  const defs: Record<string, { shortName: string; description: string; capabilities: string[] }> = {
    marketing: {
      shortName: '招聘宣传官',
      description: '负责招聘宣传、社交媒体宣发、企业微信群运营、招聘互动、活动推广',
      capabilities: ['岗位发布', '社交媒体宣发', '社群运营', '招聘互动', '活动推广'],
    },
    recruiter: {
      shortName: 'AI 招聘官',
      description: '持续扫描 Talent Pool、Candidate Ranking、主动沟通、收集资料、提交 Candidate Brief',
      capabilities: ['人才扫描', '候选人排序', '主动沟通', '资料收集', 'Candidate Brief'],
    },
    interview: {
      shortName: 'AI 面试官',
      description: '负责初面、技术面、英语测试、行为面试、自动纪要、自动评分',
      capabilities: ['初面', '技术面', '英语测试', '行为面试', '自动纪要', '面试报告'],
    },
  }
  return defs[agentType] || {
    shortName: agentType,
    description: 'AI 招聘员工',
    capabilities: [],
  }
}
