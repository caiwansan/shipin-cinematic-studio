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
    // 保留 action 字段（如 purchase_career_agent），供前端引导商业转化
    const apiError: any = new Error(err.message || err.error || `API Error: ${res.status}`)
    apiError.code = err.error
    apiError.action = err.action
    apiError.original = err
    throw apiError
  }

  return res.json()
}

// ─── Types ───

export interface CareerAgentStatus {
  hasAgent: boolean
  hasActiveSubscription?: boolean
  subscriptionStatus?: string | null
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
  // Sprint-10 Step 4A Task 02: 激活时返回的用户身份摘要
  identity?: {
    hasProfile: boolean
    name?: string
    experience?: string
    direction?: string
    skills?: string[]
  }
}

// ─── Career Workflow 类型 ───

export type CareerWorkflowType =
  | 'job_change'
  | 'skill_gap'
  | 'interview_prep'
  | 'salary_negotiation'
  | 'career_profile_analysis'

export interface CareerWorkflowStep {
  stepNumber: number
  action: string
  tool?: string
  result: 'success' | 'failed' | 'skipped'
  summary: string
  sources: string[]
}

export interface CareerWorkflowOutput {
  summary: string
  findings: Array<{
    type: 'info' | 'opportunity' | 'warning'
    content: string
    sources: string[]
  }>
  actions: Array<{
    action: string
    target: string
    priority: string
    reason: string
    sources: string[]
  }>
  plan: Array<{
    step: number
    action: string
    detail: string
    timeframe: string
  }>
}

export interface CareerWorkflowResult {
  workflowType: CareerWorkflowType
  status: 'completed' | 'partial' | 'failed'
  generatedAt: string
  steps: CareerWorkflowStep[]
  output: CareerWorkflowOutput
  metadata: {
    model: string
    tokensUsed: number
    durationMs: number
    provider: string
    toolsUsed: string[]
  }
}

// ─── 前端按钮类型 → 后端 Workflow 类型映射 ───
// 不新增后端类型，复用已有 Workflow
// Sprint-09D-01 Task 04: profile_extraction → career_profile_analysis（纯画像分析，不搜索岗位）
const WORKFLOW_TYPE_MAP: Record<string, CareerWorkflowType> = {
  profile_extraction: 'career_profile_analysis',
  resume_optimize: 'skill_gap',
  career_planning: 'job_change',
  interview_coach: 'interview_prep',
}

export function toBackendWorkflowType(btnType: string): CareerWorkflowType {
  return WORKFLOW_TYPE_MAP[btnType] || 'job_change'
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
 * 执行 Career Workflow（Sprint-09D-01 Task 02）
 * 调用已有后端 POST /api/career/workflow/execute
 */
export async function executeCareerWorkflow(workflowType: CareerWorkflowType, params?: Record<string, any>): Promise<CareerWorkflowResult> {
  return request('/workflow/execute', {
    method: 'POST',
    body: { workflowType, params: params || {} },
  })
}

/**
 * 验证 Career Agent 是否进入生产层
 */
export async function verifyCareerAgent() {
  return request('/agent/verify')
}
