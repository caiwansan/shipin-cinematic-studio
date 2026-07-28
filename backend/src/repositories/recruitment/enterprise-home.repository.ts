/**
 * enterprise-home.repository.ts — 企业首页数据访问层
 *
 * CTO Directive: Enterprise Overview Domain Separation
 * - 只查询当前 enterpriseId 的数据
 * - 所有 SQL 必须 WHERE enterpriseId = currentEnterpriseId (或通过 workspace 关联)
 * - 不能出现全表统计
 * - 不引用 Admin Repository
 *
 * Schema 现实（已验证）：
 * - JobPosting, RecruitmentConversation, RecruitmentCampaign → 有 enterpriseId
 * - InterviewSession → 只有 workspaceId，需通过 workspace 过滤
 * - JobCandidate → 只有 userId，无 workspaceId，通过 CandidateMatch 关联
 * - CandidateMatch → 有 workspaceId + candidateId
 * - EnterpriseAgentInstance → 用 tenantId（值 = JobCompanyProfile.id）
 */

import { prisma } from '../../utils/index.js'

export interface EnterpriseHomeQuery {
  enterpriseId: string
  today: Date
}

export interface EnterpriseHomeRawData {
  todayConversations: number
  todayInterviews: number
  todayCampaigns: number
  todayResumes: number
  todayOffers: number
  todayHires: number
  totalJobs: number
  totalResumes: number
  totalScreening: number
  totalConversations: number
  totalInterviews: number
  totalOffers: number
  totalHires: number
  pendingSummaries: number
  pendingInterviews: number
  pendingOffers: number
  recentConversations: Array<{ id: string; status: string; createdAt: Date }>
  recentInterviews: Array<{ id: string; status: string; createdAt: Date }>
  activeInstances: number
  pausedInstances: number
  // Sprint 07 Week 1: 今日任务数据
  pendingCandidates: number
  pendingJobs: number
  pendingResumes: number
}

export const enterpriseHomeRepository = {
  async fetchHomeData(query: EnterpriseHomeQuery): Promise<EnterpriseHomeRawData> {
    const { enterpriseId, today } = query

    // 先获取当前企业的 workspace 和 tenantId
    const workspace = await prisma.enterpriseJobWorkspace.findUnique({
      where: { enterpriseId },
      select: { id: true },
    })

    const workspaceId = workspace?.id || null

    // tenantId = EnterpriseAgentInstance.tenantId = JobCompanyProfile.id = enterpriseId
    const tenantId = enterpriseId

    const [
      todayConversations,
      todayInterviews,
      todayCampaigns,
      todayResumes,
      todayOffers,
      todayHires,
      totalJobs,
      totalResumes,
      totalScreening,
      totalConversations,
      totalInterviews,
      totalOffers,
      totalHires,
      pendingSummaries,
      pendingInterviews,
      pendingOffers,
      recentConversations,
      recentInterviews,
      activeInstances,
      pausedInstances,
      pendingCandidates,
      pendingJobs,
      pendingResumes,
    ] = await Promise.all([
      // 今日沟通（有 enterpriseId）
      prisma.recruitmentConversation.count({
        where: { enterpriseId, createdAt: { gte: today } },
      }),
      // 今日面试（通过 workspace 过滤）
      workspaceId
        ? prisma.interviewSession.count({
            where: { workspaceId, createdAt: { gte: today } },
          })
        : 0,
      // 今日 Campaign（有 enterpriseId）
      prisma.recruitmentCampaign.count({
        where: { enterpriseId, createdAt: { gte: today } },
      }),
      // 今日新增简历（通过 CandidateMatch → workspace 关联）
      workspaceId
        ? prisma.candidateMatch.count({
            where: { workspaceId, createdAt: { gte: today } },
          })
        : 0,
      // 今日 Offer（面试通过）
      workspaceId
        ? prisma.interviewSession.count({
            where: { workspaceId, status: 'PASSED', updatedAt: { gte: today } },
          })
        : 0,
      // 今日录用
      workspaceId
        ? prisma.interviewSession.count({
            where: { workspaceId, status: 'HIRED', updatedAt: { gte: today } },
          })
        : 0,
      // 漏斗：总职位
      prisma.jobPosting.count({ where: { enterpriseId } }),
      // 漏斗：总简历（通过 CandidateMatch）
      workspaceId
        ? prisma.candidateMatch.count({ where: { workspaceId } })
        : 0,
      // 漏斗：筛选通过（有沟通记录的候选人）
      prisma.recruitmentConversation.count({ where: { enterpriseId } }),
      // 漏斗：沟通
      prisma.recruitmentConversation.count({ where: { enterpriseId } }),
      // 漏斗：面试
      workspaceId
        ? prisma.interviewSession.count({ where: { workspaceId } })
        : 0,
      // 漏斗：Offer
      workspaceId
        ? prisma.interviewSession.count({
            where: { workspaceId, status: 'PASSED' },
          })
        : 0,
      // 漏斗：录用
      workspaceId
        ? prisma.interviewSession.count({
            where: { workspaceId, status: 'HIRED' },
          })
        : 0,
      // 待处理：等待 HR 复核
      prisma.recruitmentConversation.count({
        where: { enterpriseId, status: 'WAITING_HR_REVIEW' },
      }),
      // 待处理：面试通过待审核
      workspaceId
        ? prisma.interviewSession.count({
            where: { workspaceId, status: 'PASSED' },
          })
        : 0,
      // 待处理：待发送 Offer
      workspaceId
        ? prisma.interviewSession.count({
            where: { workspaceId, status: 'PASSED' },
          })
        : 0,
      // 动态：最近沟通
      prisma.recruitmentConversation.findMany({
        where: { enterpriseId, createdAt: { gte: today } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, createdAt: true },
      }),
      // 动态：最近面试
      workspaceId
        ? prisma.interviewSession.findMany({
            where: { workspaceId, createdAt: { gte: today } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, status: true, createdAt: true },
          })
        : [],
      // 部门健康：运行中（tenantId = enterpriseId）
      prisma.enterpriseAgentInstance.count({
        where: { tenantId, lifecycleState: 'ACTIVE' },
      }),
      // 部门健康：已暂停
      prisma.enterpriseAgentInstance.count({
        where: { tenantId, lifecycleState: 'PAUSED' },
      }),
      // Sprint 07 Week 1: 待分析候选人（pending 状态的匹配）
      workspaceId
        ? prisma.candidateMatch.count({
            where: { workspaceId, status: 'pending' },
          })
        : 0,
      // Sprint 07 Week 1: 待优化 JD 的岗位（草稿状态）
      prisma.jobPosting.count({
        where: { enterpriseId, status: 'draft' },
      }),
      // Sprint 07 Week 1: 待筛选简历（pending 状态的匹配）
      workspaceId
        ? prisma.candidateMatch.count({
            where: { workspaceId, status: 'pending' },
          })
        : 0,
    ])

    return {
      todayConversations,
      todayInterviews,
      todayCampaigns,
      todayResumes,
      todayOffers,
      todayHires,
      totalJobs,
      totalResumes,
      totalScreening,
      totalConversations,
      totalInterviews,
      totalOffers,
      totalHires,
      pendingSummaries,
      pendingInterviews,
      pendingOffers,
      recentConversations,
      recentInterviews,
      activeInstances,
      pausedInstances,
      pendingCandidates,
      pendingJobs,
      pendingResumes,
    }
  },
}
