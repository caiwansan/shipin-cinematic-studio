/**
 * overview.mapper.ts — 平台运营概览数据组装
 *
 * AR-01 Phase 4: Overview 模块领域化
 * CTO 指令：PlatformOverview（平台运营视角，非企业级）
 *
 * 与 enterprise-home.mapper.ts 严格分离
 */

import type { PlatformOverviewRawData } from '../../repositories/recruitment/overview.repository.js'

// ─── DTO 定义 ───

export interface PlatformOverviewDTO {
  health: {
    status: 'healthy' | 'warning' | 'critical'
    message: string
    todaySummary: string
  }
  overview: {
    enterprises: number
    workspaces: number
    aiEmployees: number
    aiInstances: number
    active: number
    paused: number
    recovering: number
    healthRate: string
  }
  today: {
    conversations: number
    interviews: number
    campaigns: number
  }
  funnel: {
    jobs: number
    resumes: number
    screening: number
    conversations: number
    interviews: number
    offers: number
    hires: number
  }
  pending: {
    summaries: number
    interviews: number
    offers: number
    total: number
  }
  activities: Array<{ time: string; text: string; type: string }>
  totals: {
    conversations: number
    interviews: number
    campaigns: number
    jobs: number
    resumes: number
  }
}

// ─── Mapper ───

export function mapPlatformOverviewToDTO(data: PlatformOverviewRawData): PlatformOverviewDTO {
  const healthRate = data.agentInstanceCount > 0
    ? ((data.activeInstances / data.agentInstanceCount) * 100).toFixed(1)
    : '100.0'

  let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
  let healthMessage = '招聘运行正常'
  if (data.pendingSummaries > 5 || data.pendingInterviews > 3) {
    healthStatus = 'warning'
    healthMessage = `需要关注：${data.pendingSummaries} 份候选人摘要等待确认`
  }
  if (data.pausedInstances > data.activeInstances) {
    healthStatus = 'critical'
    healthMessage = '需要关注：超过半数招聘流程已暂停'
  }

  const activities: Array<{ time: string; text: string; type: string }> = []
  for (const c of data.recentConversations) {
    activities.push({
      time: new Date(c.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      text: '新沟通开始',
      type: 'conversation',
    })
  }
  for (const i of data.recentInterviews) {
    activities.push({
      time: new Date(i.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      text: `面试${i.status === 'PASSED' ? '通过' : '开始'}`,
      type: 'interview',
    })
  }
  activities.sort((a, b) => b.time.localeCompare(a.time))

  return {
    health: {
      status: healthStatus,
      message: healthMessage,
      todaySummary: `今天 ${data.todayConversations} 次沟通，${data.todayInterviews} 次面试，${data.pendingSummaries + data.pendingInterviews} 人等待确认`,
    },
    overview: {
      enterprises: data.enterpriseCount,
      workspaces: data.workspaceCount,
      aiEmployees: data.agentProfileCount,
      aiInstances: data.agentInstanceCount,
      active: data.activeInstances,
      paused: data.pausedInstances,
      recovering: data.recoveringInstances,
      healthRate: `${healthRate}%`,
    },
    today: {
      conversations: data.todayConversations,
      interviews: data.todayInterviews,
      campaigns: data.todayCampaigns,
    },
    funnel: {
      jobs: data.jobCount,
      resumes: data.todayResumes,
      screening: data.screeningCount,
      conversations: data.todayConversations,
      interviews: data.todayInterviews,
      offers: data.offerCount,
      hires: data.hireCount,
    },
    pending: {
      summaries: data.pendingSummaries,
      interviews: data.pendingInterviews,
      offers: data.pendingOffers,
      total: data.pendingSummaries + data.pendingInterviews + data.pendingOffers,
    },
    activities: activities.slice(0, 10),
    totals: {
      conversations: data.conversationCount,
      interviews: data.interviewCount,
      campaigns: data.campaignCount,
      jobs: data.jobCount,
      resumes: data.resumeCount,
    },
  }
}
