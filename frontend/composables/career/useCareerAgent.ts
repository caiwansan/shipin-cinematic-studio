import { getAuthToken } from '~/utils/auth/token'
/**
 * useCareerAgent — AI 职业助理数据层
 *
 * 对接后端 /api/career/agent/* + /api/career/workflow/*
 * 获取当前用户的 AI 职业助理状态、能力、执行 Workflow
 *
 * 数据源：真实数据库（EnterpriseAgentProfile + EnterpriseAgentInstance + HermesProfileBinding）
 * 禁止：mock 数据、localStorage fallback、固定 UUID
 *
 * 架构对齐：
 *   useAgentWorkforce.ts (企业端) ↔ useCareerAgent.ts (求职端)
 */
import type { Ref } from 'vue'

export interface CareerAgentInfo {
  profileId: string
  instanceId: string
  bindingId: string
  hermesAgentId: string
  memoryNamespace: string
  agentName: string
  status: 'active' | 'paused' | 'draft'
  tools: string[]
}

export interface CareerAgentState {
  hasAgent: boolean
  agent: CareerAgentInfo | null
  loading: boolean
  error: string
}

export interface WorkflowExecutionResult {
  workflowType: string
  status: string
  summary?: string
  steps?: Array<{ name: string; status: string; result?: any }>
  output?: any
  executedAt?: string
}

export type CareerWorkflowType = 'job_change' | 'skill_gap' | 'interview_prep' | 'salary_negotiation'

export interface CareerWorkflowParams {
  jobTitle?: string
  targetIndustry?: string
  city?: string
  minSalary?: number
  companyName?: string
  interviewType?: string
  [key: string]: any
}

let cache: {
  agent: CareerAgentInfo | null
  hasAgent: boolean
  timestamp: number
} | null = null

const CACHE_TTL = 30_000 // 30s

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken() || ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function useCareerAgent(): {
  state: Ref<CareerAgentState>
  refresh: () => Promise<void>
  createAgent: (goal?: string, resumeId?: string) => Promise<CareerAgentInfo | null>
  executeWorkflow: (workflowType: CareerWorkflowType, params?: CareerWorkflowParams) => Promise<WorkflowExecutionResult | null>
  getHistory: (limit?: number, offset?: number) => Promise<any[]>
  clearCache: () => void
} {
  const state = ref<CareerAgentState>({
    hasAgent: false,
    agent: null,
    loading: false,
    error: '',
  }) as Ref<CareerAgentState>

  async function refresh() {
    // 缓存命中
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      state.value = {
        hasAgent: cache.hasAgent,
        agent: cache.agent,
        loading: false,
        error: '',
      }
      return
    }

    state.value.loading = true
    state.value.error = ''

    try {
      const res = await fetch('/api/career/agent/status', {
        headers: getAuthHeaders(),
      })

      if (!res.ok) throw new Error(`Career Agent API ${res.status}`)

      const json = await res.json()

      const agent: CareerAgentInfo | null = json.agent || null
      const hasAgent = json.hasAgent === true

      cache = { agent, hasAgent, timestamp: Date.now() }

      state.value = { hasAgent, agent, loading: false, error: '' }
    } catch (e: any) {
      state.value.error = e.message || '查询 AI 职业助理失败'
      state.value.loading = false
    }
  }

  async function createAgent(goal?: string, resumeId?: string): Promise<CareerAgentInfo | null> {
    state.value.loading = true
    state.value.error = ''

    try {
      // 使用 activate-and-execute 创建 Agent 并执行首次任务
      const res = await fetch('/api/career/agent/activate-and-execute', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ goal, resumeId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // BYOK Gate: 用户未配置 LLM Key
        if (err.error === 'NO_BYOK_CONFIG') {
          state.value.error = err.message || '请先配置您的AI模型API Key'
          state.value.loading = false
          return null
        }
        throw new Error(err.message || `Create Agent API ${res.status}`)
      }

      const json = await res.json()
      const agent: CareerAgentInfo = {
        profileId: json.agent.profileId,
        instanceId: json.agent.instanceId,
        bindingId: json.agent.bindingId,
        hermesAgentId: json.agent.hermesAgentId,
        memoryNamespace: json.agent.memoryNamespace,
        agentName: json.agent.name || '',
        status: json.agent.status,
        tools: json.agent.tools || [],
      }

      cache = { agent, hasAgent: true, timestamp: Date.now() }

      state.value = { hasAgent: true, agent, loading: false, error: '' }
      return agent
    } catch (e: any) {
      state.value.error = e.message || '创建 AI 职业助理失败'
      state.value.loading = false
      return null
    }
  }

  async function executeWorkflow(
    workflowType: CareerWorkflowType,
    params?: CareerWorkflowParams
  ): Promise<WorkflowExecutionResult | null> {
    try {
      const res = await fetch('/api/career/workflow/execute', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ workflowType, params }),
      })

      if (!res.ok) throw new Error(`Workflow API ${res.status}`)

      const json = await res.json()
      return json as WorkflowExecutionResult
    } catch (e: any) {
      state.value.error = e.message || '执行 Workflow 失败'
      return null
    }
  }

  async function getHistory(limit = 20, offset = 0): Promise<any[]> {
    try {
      const res = await fetch(`/api/career/workflow/history?limit=${limit}&offset=${offset}`, {
        headers: getAuthHeaders(),
      })

      if (!res.ok) throw new Error(`History API ${res.status}`)

      const json = await res.json()
      return json.items || []
    } catch {
      return []
    }
  }

  function clearCache() {
    cache = null
  }

  return { state, refresh, createAgent, executeWorkflow, getHistory, clearCache }
}
