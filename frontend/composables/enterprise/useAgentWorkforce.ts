/**
 * useAgentWorkforce — AI Workforce 数据层
 *
 * 对接后端 /api/enterprise/media-department/agents
 * 获取当前企业租户的 AI 员工实例列表和统计摘要
 *
 * 数据源：真实数据库（EnterpriseAgentInstance + EnterpriseAgentProfile）
 * 禁止：mock 数据、localStorage fallback、固定 UUID
 */
import type { Ref } from 'vue'

export interface AgentInstance {
  id: string
  name: string
  type: string
  status: 'active' | 'paused' | 'archived' | string
  runtime: string
  capabilities: string[]
  emergencyStop: boolean
  createdAt: string
  lastActiveAt: string | null
  totalTasks: number
  totalErrors: number
  metadata: Record<string, any> | null
}

export interface AgentSummary {
  total: number
  active: number
  paused: number
  capacity: number
}

export interface AgentWorkforceState {
  instances: AgentInstance[]
  summary: AgentSummary
  loading: boolean
  error: string
}

function parseCapabilities(cap: string | string[] | null | undefined): string[] {
  if (!cap) return []
  if (Array.isArray(cap)) return cap
  try {
    const parsed = JSON.parse(cap)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

let cache: {
  instances: AgentInstance[]
  summary: AgentSummary
  timestamp: number
} | null = null

const CACHE_TTL = 30_000 // 30s

export interface CopilotAction {
  type: 'candidate_analysis' | 'communication_draft' | 'interview_suggestion' | 'pipeline_suggestion'
  candidateName: string
  jobTitle?: string
  commType?: string
}

export function useAgentWorkforce(): {
  state: Ref<AgentWorkforceState>
  refresh: () => Promise<void>
  executeAction: (action: CopilotAction) => Promise<any>
} {
  const state = ref<AgentWorkforceState>({
    instances: [],
    summary: { total: 0, active: 0, paused: 0, capacity: 20 },
    loading: false,
    error: '',
  }) as Ref<AgentWorkforceState>

  async function refresh() {
    // 缓存命中
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      state.value = {
        instances: cache.instances,
        summary: cache.summary,
        loading: false,
        error: '',
      }
      return
    }

    state.value.loading = true
    state.value.error = ''

    try {
      const token = localStorage.getItem('auth_token') || ''
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      const [agentsRes, summaryRes] = await Promise.all([
        fetch('/api/enterprise/media-department/agents', { headers }),
        fetch('/api/enterprise/media-department/agents/summary', { headers }),
      ])

      if (!agentsRes.ok) throw new Error(`agents API ${agentsRes.status}`)
      if (!summaryRes.ok) throw new Error(`summary API ${summaryRes.status}`)

      const agentsJson = await agentsRes.json()
      const summaryJson = await summaryRes.json()

      // 解析 capabilities JSON 字符串 → string[]
      const rawInstances: any[] = agentsJson.data?.instances || []
      const instances: AgentInstance[] = rawInstances.map((i: any) => ({
        ...i,
        capabilities: parseCapabilities(i.capabilities),
      }))

      const summary: AgentSummary = summaryJson.data || {
        total: instances.length,
        active: instances.filter((i: AgentInstance) => i.status === 'active').length,
        paused: instances.filter((i: AgentInstance) => i.status === 'paused').length,
        capacity: 20,
      }

      cache = { instances, summary, timestamp: Date.now() }

      state.value = { instances, summary, loading: false, error: '' }
    } catch (e: any) {
      state.value.error = e.message || '加载 AI 员工数据失败'
      state.value.loading = false
    }
  }

  // ─── Copilot Action 执行 ───────────────────────────────────
  async function executeAction(action: CopilotAction): Promise<any> {
    const token = localStorage.getItem('auth_token') || ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    // 根据 action type 路由到对应 API
    const endpointMap: Record<string, string> = {
      candidate_analysis: '/api/enterprise/agents/action/analyze-candidate',
      communication_draft: '/api/enterprise/agents/action/communication',
      interview_suggestion: '/api/enterprise/agents/action/suggest-interview',
      pipeline_suggestion: '/api/enterprise/agents/action/suggest-pipeline',
    }

    const endpoint = endpointMap[action.type]
    if (!endpoint) throw new Error(`Unknown action type: ${action.type}`)

    const body: Record<string, any> = {
      candidateName: action.candidateName,
    }
    if (action.jobTitle) body.jobTitle = action.jobTitle
    if (action.commType) body.commType = action.commType

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Action API ${res.status}`)
    const json = await res.json()
    return json.data || null
  }

  return { state, refresh, executeAction }
}
