import { getAuthToken } from '~/utils/auth/token'
/**
 * Media Department · API Client for Kunlun /api/v1
 * 
 * 替换旧的 /api/enterprise/media-department/* 端点
 * 统一：认证、organizationId 注入、响应解析
 */

// 真实后端端点：/api/enterprise/* （/api/v1 从未在后端注册，历史假端点）
const API_BASE = '/api/enterprise'

export interface ApiResult<T> {
  data: T
  error?: string
}

function getToken(): string {
  try { return getAuthToken() || '' } catch { return '' }
}

function getOrgId(): string {
  try { return localStorage.getItem('organizationId') || '' } catch { return '' }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

function orgQuery(): string {
  const orgId = getOrgId()
  return orgId ? `?organizationId=${orgId}` : ''
}

async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}${orgQuery()}`, {
      headers: authHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      return { data: null as any, error: err.error || `HTTP ${res.status}` }
    }
    const json = await res.json()
    // 响应格式兼容：{ data: {...} } 或 { data: { employees: [...] } } 或直接数据
    const d = json.data ?? json
    return { data: d }
  } catch (e: any) {
    return { data: null as any, error: e.message || 'Network error' }
  }
}

async function apiPost<T>(path: string, body: any): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}${orgQuery()}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      return { data: null as any, error: err.error || `HTTP ${res.status}` }
    }
    const json = await res.json()
    const d = json.data ?? json
    return { data: d }
  } catch (e: any) {
    return { data: null as any, error: e.message || 'Network error' }
  }
}

// ─── API Endpoints ───

export interface EmployeeDto {
  id: string
  name: string
  role?: string
  status?: string
  type?: string
  capabilities?: string[]
  valueSummary?: { monthlyValueUsd: number; tasksCompleted: number }
}

export interface OnboardingStatusDto {
  organizationId: string
  status: string
  step: string
  completedAt?: string
  hasOrganization: boolean
  organizationName?: string
}

export interface CeoValueSummaryDto {
  period: string
  totalValueUsd: number
  totalCostUsd: number
  roi: number
  tasksCompleted: number
  opportunities: number
  byEmployee: Array<{ name: string; valueUsd: number; tasks: number }>
}

export interface BrandVoiceDto {
  id: string
  brandVoice: string
  tone: string
}

export interface ProductDto {
  id: string
  name: string
  price: number
  category?: string
}

export interface AudienceDto {
  id: string
  name: string
  ageRange?: string
}

export const KunlunMediaApi = {
  // Auth
  login: (email: string, password: string) =>
    apiPost<{ token: string; user: any }>('/auth/login', { email, password }),

  getMe: () => apiGet<any>('/auth/me'),

  // Employees — 真实端点：/api/enterprise/media-department/employees (profile+instance 合并)
  getEmployees: () => apiGet<EmployeeDto[]>('/media-department/employees'),
  getEmployee: (id: string) => apiGet<EmployeeDto>(`/media-department/employees/${id}`),
  getEmployeeValueSummary: (id: string) => apiGet<any>(`/media-department/employees/${id}/value-summary`),

  // Onboarding — 真实端点：/api/enterprise/onboarding/status
  getOnboardingStatus: () => apiGet<OnboardingStatusDto>('/onboarding/status'),

  // Subscription — 真实端点：/api/enterprise/subscription/current（套餐 SSOT）
  getSubscriptionCurrent: () => apiGet<any>('/subscription/current'),

  // CEO Analytics（暂未接线，保留接口）
  getCeoValueSummary: () => apiGet<CeoValueSummaryDto>('/ceo/value-summary'),

  // Knowledge / Organization
  saveBrandVoice: (voice: string, tone: string) =>
    apiPost<BrandVoiceDto>('/knowledge/brand-voice', { brandVoice: voice, tone }),

  saveProduct: (name: string, price: number) =>
    apiPost<ProductDto>('/knowledge/product-catalog', { name, price }),

  saveAudience: (name: string, ageRange: string) =>
    apiPost<AudienceDto>('/knowledge/audience-profiles', { name, ageRange }),

  // Tasks
  createTask: (employeeId: string, type: string, brief: string) =>
    apiPost<any>('/tasks', {
      agentInstanceId: employeeId,
      taskType: type,
      description: brief,
      tenantId: 'tenant-955d2b1a',
    }),
}
