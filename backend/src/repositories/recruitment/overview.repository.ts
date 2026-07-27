/**
 * overview.repository.ts — 平台运营概览数据访问层
 *
 * AR-01 Phase 4: Overview 模块领域化
 * CTO 指令：Admin Overview = PlatformOverview（平台级指标，非企业级）
 *
 * 与 enterprise-home.repository.ts 严格分离：
 * - 本 Repository 服务于 /api/admin/recruitment/overview（平台运营视角）
 * - enterprise-home.repository.ts 服务于 /api/enterprise/home（企业视角）
 */

import { prisma } from '../../utils/index.js'

export interface PlatformOverviewRawData {
  enterpriseCount: number
  workspaceCount: number
  agentProfileCount: number
  agentInstanceCount: number
  activeInstances: number
  pausedInstances: number
  recoveringInstances: number
  conversationCount: number
  interviewCount: number
  campaignCount: number
  jobCount: number
  resumeCount: number
  todayConversations: number
  todayInterviews: number
  todayCampaigns: number
  todayResumes: number
  screeningCount: number
  offerCount: number
  hireCount: number
  pendingSummaries: number
  pendingInterviews: number
  pendingOffers: number
  recentConversations: Array<{ id: string; status: string; createdAt: Date }>
  recentInterviews: Array<{ id: string; status: string; createdAt: Date }>
}

export const overviewRepository = {
  async fetchPlatformOverview(today: Date): Promise<PlatformOverviewRawData> {
    const [
      enterpriseCount,
      workspaceCount,
      agentProfileCount,
      agentInstanceCount,
      activeInstances,
      pausedInstances,
      recoveringInstances,
      conversationCount,
      interviewCount,
      campaignCount,
      jobCount,
      resumeCount,
      todayConversations,
      todayInterviews,
      todayCampaigns,
      todayResumes,
      screeningCount,
      offerCount,
      hireCount,
      pendingSummaries,
      pendingInterviews,
      pendingOffers,
      recentConversations,
      recentInterviews,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.enterpriseJobWorkspace.count(),
      prisma.enterpriseAgentProfile.count(),
      prisma.enterpriseAgentInstance.count(),
      prisma.enterpriseAgentInstance.count({ where: { lifecycleState: 'ACTIVE' } }),
      prisma.enterpriseAgentInstance.count({ where: { lifecycleState: 'PAUSED' } }),
      prisma.enterpriseAgentInstance.count({ where: { lifecycleState: 'RECOVERING' } }),
      prisma.recruitmentConversation.count(),
      prisma.interviewSession.count(),
      prisma.recruitmentCampaign.count(),
      prisma.jobPosting.count(),
      prisma.resume.count(),
      // 今日数据
      prisma.recruitmentConversation.count({ where: { createdAt: { gte: today } } }),
      prisma.interviewSession.count({ where: { createdAt: { gte: today } } }),
      prisma.recruitmentCampaign.count({ where: { createdAt: { gte: today } } }),
      // 漏斗：今日收到简历
      prisma.resume.count({ where: { createdAt: { gte: today } } }),
      // 漏斗：筛选通过（今日进入沟通的候选人）
      prisma.recruitmentConversation.count({ where: { createdAt: { gte: today } } }),
      // 漏斗：今日 Offer（面试通过）
      prisma.interviewSession.count({ where: { status: 'PASSED', updatedAt: { gte: today } } }),
      // 漏斗：今日录用
      prisma.interviewSession.count({ where: { status: 'HIRED', updatedAt: { gte: today } } }),
      // 待处理
      prisma.recruitmentConversation.count({ where: { status: 'WAITING_HR_REVIEW' } }),
      prisma.interviewSession.count({ where: { status: 'PASSED' } }),
      prisma.interviewSession.count({ where: { status: 'PASSED' } }),
      // 今日招聘动态
      prisma.recruitmentConversation.findMany({
        where: { createdAt: { gte: today } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, createdAt: true },
      }),
      prisma.interviewSession.findMany({
        where: { createdAt: { gte: today } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, createdAt: true },
      }),
    ])

    return {
      enterpriseCount,
      workspaceCount,
      agentProfileCount,
      agentInstanceCount,
      activeInstances,
      pausedInstances,
      recoveringInstances,
      conversationCount,
      interviewCount,
      campaignCount,
      jobCount,
      resumeCount,
      todayConversations,
      todayInterviews,
      todayCampaigns,
      todayResumes,
      screeningCount,
      offerCount,
      hireCount,
      pendingSummaries,
      pendingInterviews,
      pendingOffers,
      recentConversations,
      recentInterviews,
    }
  },
}
