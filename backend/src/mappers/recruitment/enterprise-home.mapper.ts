/**
 * enterprise-home.mapper.ts — 企业首页数据组装
 *
 * CTO Directive: Enterprise Overview Domain Separation
 * - 将 Repository 原始数据组装为 EnterpriseHomeDTO
 * - Route 不允许组装数据
 */

import type { EnterpriseHomeRawData } from '../../repositories/recruitment/enterprise-home.repository.js'

// ─── DTO 定义 ───

export interface FunnelStage {
  label: string
  value: number
}

export interface PendingItem {
  label: string
  count: number
}

export interface ActivityItem {
  time: string
  text: string
  type: string
}

export interface TodayMetrics {
  conversations: number
  interviews: number
  campaigns: number
  newResumes: number
  offers: number
  hires: number
  // Sprint 07 Week 1: 今日任务数据
  pendingCandidates?: number
  pendingJobs?: number
  pendingResumes?: number
}

export interface DepartmentHealth {
  status: 'healthy' | 'warning' | 'critical'
  message: string
  activeCount: number
  pausedCount: number
}

export interface EnterpriseHomeDTO {
  todayMetrics: TodayMetrics
  funnel: FunnelStage[]
  needsAttention: PendingItem[]
  activityFeed: ActivityItem[]
  departmentHealth: DepartmentHealth
}

// ─── Mapper ───

function buildFunnel(data: EnterpriseHomeRawData): FunnelStage[] {
  return [
    { label: '职位', value: data.totalJobs },
    { label: '收到简历', value: data.totalResumes },
    { label: '筛选', value: data.totalScreening },
    { label: '沟通', value: data.totalConversations },
    { label: '面试', value: data.totalInterviews },
    { label: 'Offer', value: data.totalOffers },
    { label: '录用', value: data.totalHires },
  ]
}

function buildNeedsAttention(data: EnterpriseHomeRawData): PendingItem[] {
  return [
    { label: '候选人摘要待确认', count: data.pendingSummaries },
    { label: '面试评估待审核', count: data.pendingInterviews },
    { label: 'Offer 待发送', count: data.pendingOffers },
  ]
}

function buildActivityFeed(data: EnterpriseHomeRawData): ActivityItem[] {
  const items: ActivityItem[] = []

  for (const c of data.recentConversations) {
    items.push({
      time: formatTime(c.createdAt),
      text: '新沟通开始',
      type: 'conversation',
    })
  }

  for (const i of data.recentInterviews) {
    items.push({
      time: formatTime(i.createdAt),
      text: i.status === 'PASSED' ? '面试通过' : '面试开始',
      type: 'interview',
    })
  }

  items.sort((a, b) => b.time.localeCompare(a.time))
  return items.slice(0, 10)
}

function buildDepartmentHealth(data: EnterpriseHomeRawData): DepartmentHealth {
  const total = data.activeInstances + data.pausedInstances
  if (total === 0) {
    return {
      status: 'healthy',
      message: '暂无 AI 员工',
      activeCount: 0,
      pausedCount: 0,
    }
  }

  if (data.pausedInstances > data.activeInstances) {
    return {
      status: 'critical',
      message: '超过半数 AI 员工已暂停',
      activeCount: data.activeInstances,
      pausedCount: data.pausedInstances,
    }
  }

  if (data.pausedInstances > 0) {
    return {
      status: 'warning',
      message: `${data.pausedInstances} 个 AI 员工已暂停`,
      activeCount: data.activeInstances,
      pausedCount: data.pausedInstances,
    }
  }

  return {
    status: 'healthy',
    message: '招聘运行正常',
    activeCount: data.activeInstances,
    pausedCount: data.pausedInstances,
  }
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── 入口函数 ───

export function mapEnterpriseHome(data: EnterpriseHomeRawData): EnterpriseHomeDTO {
  return {
    todayMetrics: {
      conversations: data.todayConversations,
      interviews: data.todayInterviews,
      campaigns: data.todayCampaigns,
      newResumes: data.todayResumes,
      offers: data.todayOffers,
      hires: data.todayHires,
      // Sprint 07 Week 1: 今日任务数据
      pendingCandidates: data.pendingCandidates || 0,
      pendingJobs: data.pendingJobs || 0,
      pendingResumes: data.pendingResumes || 0,
    },
    funnel: buildFunnel(data),
    needsAttention: buildNeedsAttention(data),
    activityFeed: buildActivityFeed(data),
    departmentHealth: buildDepartmentHealth(data),
  }
}
