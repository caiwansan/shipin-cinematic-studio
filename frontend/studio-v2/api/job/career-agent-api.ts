/**
 * career-agent-api.ts — Career Agent 真实状态 API Client
 * 
 * Sprint-03C: Frontend Reality Integration
 * 连接后端: /api/career/agent/status, /api/career/agent/activate-and-execute
 */
import { getToken } from '~/utils/token-cache'

const BASE_URL = '/api/career'

interface ApiOptions {
  method?: string
  body?: any
  params?: Record<string, string>
}

async function request(path: string, options: ApiOptions = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let url = `${BASE_URL}${path}`
  if (options.params) {
    const qs = new URLSearchParams(options.params).toString()
    url += `?${qs}`
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.message || `API Error: ${res.status}`)
  }

  return res.json()
}

// ─── Types ───

export interface CareerAgentStatus {
  hasAgent: boolean
  status: 'not_created' | 'active' | 'paused' | 'running' | 'error'
  agent?: {
    profileId: string
    instanceId: string
    name: string
    runtime: string
    lifecycleState: string
    tools: string[]
    memoryNamespace: string
    identityProvider?: string
  }
  stats: {
    totalTasks: number
    completedTasks: number
    failedTasks: number
  }
  recentTasks: Array<{
    id: string
    taskType: string
    status: 'running' | 'completed' | 'failed'
    inputSummary: string
    startedAt: string
    completedAt?: string
  }>
  message?: string
}

export interface CareerAgentActivateResult {
  message: string
  agent: {
    profileId: string
    instanceId: string
    bindingId: string
    hermesAgentId: string
    memoryNamespace: string
    identityProvider: string
    status: string
    created: boolean
  }
  execution: {
    taskId: string
    status: string
    output?: string
    tokenInput: number
    tokenOutput: number
    cost: number
    durationMs: number
    outcomeId?: string
    actionId?: string
  }
}

// ─── API Functions ───

/**
 * 获取 Career Agent 真实状态
 */
export async function getCareerAgentStatus(): Promise<CareerAgentStatus> {
  return request('/agent/status')
}

/**
 * 激活 Career Agent 并执行首次任务
 */
export async function activateAndExecuteCareerAgent(params?: {
  instruction?: string
  goal?: string
}): Promise<CareerAgentActivateResult> {
  return request('/agent/activate-and-execute', {
    method: 'POST',
    body: params || {},
  })
}

/**
 * 验证 Career Agent 是否进入生产层
 */
export async function verifyCareerAgent() {
  return request('/agent/verify')
}
