/**
 * useRecruitmentHome — 企业招聘中心首页数据层
 *
 * 对接后端:
 *   GET /api/enterprise/home                   → 仪表盘数据 (KPI/漏斗/待处理/动态)
 *   GET /api/enterprise/recruitment/agents     → 招聘专用 AI 员工列表
 *
 * 替换:
 *   useAgentWorkforce (media-department/agents 通用Agent池 → 不再使用)
 *
 * 数据来源: JobPosting / CandidateMatch / InterviewSession / Offer 等真实招聘模型
 */

import { ref, computed, type Ref } from 'vue'
import { getAuthToken } from '~/utils/auth/token'

// ─── 类型定义 ───

export interface TodayMetrics {
  conversations: number
  interviews: number
  campaigns: number
  newResumes: number
  offers: number
  hires: number
  pendingCandidates: number
  pendingJobs: number
  pendingResumes: number
}

export interface FunnelStage {
  label: string
  value: number
}

export interface AttentionItem {
  label: string
  count: number
}

export interface ActivityItem {
  time: string
  text: string
  type: string
}

export interface DepartmentHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  message: string
  activeCount: number
  pausedCount: number
}

export interface RecruitmentHomeData {
  hasEnterprise: boolean
  message?: string
  todayMetrics: TodayMetrics
  funnel: FunnelStage[]
  needsAttention: AttentionItem[]
  activityFeed: ActivityItem[]
  departmentHealth: DepartmentHealth
}

export interface RecruitmentAgent {
  id: string
  type: 'marketing' | 'recruiter' | 'interview'
  name: string
  shortName: string
  status: 'active' | 'paused' | 'busy'
  capabilities: string[]
  usage: number
  lastActive: string
  createdAt: string
}

// ─── 预定义的招聘Agent 角色元数据 ───

const AGENT_META: Record<string, { emoji: string; shortName: string; label: string }> = {
  recruiter: {
    emoji: '🤖',
    shortName: 'AI 招聘官',
    label: '人才扫描 · 候选人排序 · 主动沟通',
  },
  marketing: {
    emoji: '📢',
    shortName: '招聘宣传官',
    label: '岗位发布 · 社媒宣发 · 社群运营',
  },
  interview: {
    emoji: '🎤',
    shortName: 'AI 面试官',
    label: '初面 · 技术面 · 英语测试 · 面试报告',
  },
  // Legacy type 兼容
  talent_scout: { emoji: '🔍', shortName: '猎聘顾问', label: '人才搜索 · 简历筛选' },
  talent_researcher: { emoji: '🔍', shortName: '人才研究员', label: '人才分析 · 市场调研' },
  screener: { emoji: '📋', shortName: '简历筛选', label: '简历初筛·资格验证' },
  coordinator: { emoji: '📅', shortName: '招聘协调员', label: '面试安排 · 日程协调' },
  campaign: { emoji: '📢', shortName: '招聘活动经理', label: '招聘活动 · 雇主品牌' },
  analyst: { emoji: '📊', shortName: '招聘分析师', label: '招聘数据 · 效果分析' },
}

// ─── Composables ───

export interface RecruitmentHomeState {
  dashboard: RecruitmentHomeData | null
  agents: RecruitmentAgent[]
  loading: boolean
  error: string
}

export function useRecruitmentHome(): {
  state: Ref<RecruitmentHomeState>
  refresh: () => Promise<void>
} {
  const state = ref<RecruitmentHomeState>({
    dashboard: null,
    agents: [],
    loading: false,
    error: '',
  }) as Ref<RecruitmentHomeState>

  const token = computed(() => getAuthToken() || '')
  const headers = computed<Record<string, string>>(() => ({
    'Content-Type': 'application/json',
    ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
  }))

  async function refresh() {
    state.value.loading = true
    state.value.error = ''

    try {
      const [homeRes, agentsRes] = await Promise.all([
        fetch('/api/enterprise/home', { headers: headers.value }),
        fetch('/api/enterprise/recruitment/agents', { headers: headers.value }),
      ])

      if (!homeRes.ok) throw new Error(`Home API ${homeRes.status}`)

      const homeData: RecruitmentHomeData = await homeRes.json()

      let agents: RecruitmentAgent[] = []
      if (agentsRes.ok) {
        const agentsJson = await agentsRes.json()
        agents = agentsJson.data || agentsJson.agents || []
      } else {
        // fallback: 从 home 数据的 activeInstances 构造占位
        const health = homeData.departmentHealth
        agents = buildPlaceholderAgents(health.activeCount)
      }

      state.value = { dashboard: homeData, agents, loading: false, error: '' }
    } catch (e: any) {
      state.value.error = e.message || '加载招聘数据失败'
      state.value.loading = false
    }
  }

  return { state, refresh }
}

// ─── 占位 Agent 构造（当后端 endpoint 不存在时） ───

function buildPlaceholderAgents(activeCount: number): RecruitmentAgent[] {
  const types: Array<{ type: RecruitmentAgent['type']; name: string }> = [
    { type: 'recruiter', name: '招聘经理' },
    { type: 'marketing', name: '招聘宣传官' },
    { type: 'interview', name: 'AI 面试官' },
  ]

  return types.map((t, i) => ({
    id: `rec-${t.type}`,
    type: t.type,
    name: t.name,
    shortName: AGENT_META[t.type]?.shortName || t.name,
    status: i < activeCount ? 'active' : 'paused',
    capabilities: [],
    usage: 0,
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }))
}

export { AGENT_META }
