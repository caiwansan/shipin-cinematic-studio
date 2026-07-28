/**
 * enterprise-identity-api.ts — 企业身份 API Client
 *
 * 归属: 企业招聘中心 (Enterprise Recruitment) → /workspace/enterprise
 * 审计: JOB-WORKSPACE-BOUNDARY-AUDIT 2026-07-26 — P4-FE-02
 *
 * 职责:
 *   企业身份状态查询、Onboarding 流程
 *   复用现有 /api/identity/context 和 /enterprise/onboarding/* API
 *   不重复造模型
 */
import { getToken } from '~/utils/token-cache'

interface ApiOptions {
  method?: string
  body?: any
  params?: Record<string, string>
}

async function apiRequest(path: string, options: ApiOptions = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let url = path
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
    throw new Error(`API Error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

// ─── 企业身份状态 ───

export interface EnterpriseIdentityStatus {
  hasEnterprise: boolean
  enterprise: {
    id: string
    name: string
    industry?: string
    onboardingStep?: number
    onboardingDone?: boolean
  } | null
  workspace: {
    id: string
    name: string
    plan: string
    status?: string
  } | null
  subscription: {
    id: string
    status: string
    plan?: { id: string; name: string; displayName: string } | null
    expireAt?: string
  } | null
}

/**
 * 获取当前用户的企业身份上下文
 * 后端: GET /api/identity/context
 */
export async function getEnterpriseIdentity(): Promise<EnterpriseIdentityStatus> {
  const res = await apiRequest('/api/identity/context')
  return res.data
}

// ─── Onboarding 状态 ───

export interface OnboardingState {
  id: string
  workspaceId: string
  enterpriseId: string
  currentStep: number
  totalSteps: number
  completed: boolean
  stepCompanyDone: boolean
  stepNeedsDone: boolean
  stepAgentDone: boolean
  stepPlanDone: boolean
  stepDashboardDone: boolean
  completedAt?: string
}

/**
 * 获取 onboarding 状态
 * 后端: GET /enterprise/onboarding/v2/status
 */
export async function getOnboardingStatus(enterpriseId: string): Promise<OnboardingState | null> {
  const res = await apiRequest('/api/enterprise/onboarding/v2/status', {
    params: { enterpriseId },
  })
  return res.state || null
}

// ─── Step 1: 创建企业档案 ───

export interface CreateEnterpriseParams {
  enterpriseId: string
  companyName: string
  industry: string
  scale: string
  website?: string
  description?: string
}

/**
 * Step 1: 创建企业档案
 * 后端: POST /enterprise/onboarding/step1
 */
export async function createEnterpriseProfile(params: CreateEnterpriseParams) {
  return apiRequest('/api/enterprise/onboarding/step1', {
    method: 'POST',
    body: params,
  })
}

// ─── 获取套餐列表 ───

/**
 * 获取可选套餐
 * 后端: GET /enterprise/plans
 */
export async function getEnterprisePlans() {
  const res = await apiRequest('/api/enterprise/plans')
  return res.plans
}
